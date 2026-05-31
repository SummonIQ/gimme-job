// hooks/useReportData.ts
'use client';

// lodash removed - not currently used
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { useSession } from '@/lib/auth/client';
import type { ApiQuery } from '@/types/reporting/query';

interface UseReportDataOptions<T, I> {
  cacheKey?: string;
  initialData?: T[];
  initialTotalCount?: number;
  initialQuery?: ApiQuery<T, I>;
  model: string;
}

export function useReportData<T, I>({
  cacheKey,
  model,
  initialQuery,
  initialData,
  initialTotalCount,
}: UseReportDataOptions<T, I>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selfUpdating = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<T[] | null>(initialData ?? null);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount ?? 0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const session = useSession();

  // Parse the URL using our simplified parser.
  // Reads the raw query string (no URLSearchParams) so structural separators
  // ":" and "," stay distinguishable from per-value escapes like "%2C".
  const parseApiQueryFromSearchParams = useCallback(
    (rawQueryString: string, initial?: ApiQuery<T, I>): ApiQuery<T, I> => {
      // Start with the initial query if provided
      const baseQuery = initial || {};
      const params = parseRawQueryString(rawQueryString);

      // Pagination: read "start" and "count", fallback to initial values or defaults
      const startStr = params.get('start');
      const countStr = params.get('count');
      const pagination = {
        count: countStr
          ? parseInt(countStr)
          : (baseQuery.pagination?.count ?? 10),
        start: startStr
          ? parseInt(startStr)
          : (baseQuery.pagination?.start ?? 0),
      };

      // Sort: parse "sort" parameter (e.g. "createdAt:desc,field2:asc")
      let sort;
      const sortStr = params.get('sort');
      if (sortStr) {
        sort = recoverStructuralForm(sortStr).split(',').map(item => {
          const [field, direction] = item.split(':');
          return { direction, field } as any;
        });
      }

      // Filters: parse "filter" parameter (e.g. "status:in:ACTIVE;title:contains:foo")
      let filters;
      const filterStr = params.get('filter');
      if (filterStr) {
        filters = splitFilterEntries(recoverStructuralForm(filterStr))
          .map(item => {
            const parts = item.split(':');
            if (parts.length < 3) return null;
            const field = parts[0];
            const operator = parts[1];
            const value = decodeURIComponent(parts.slice(2).join(':'));
            if (value === 'true') {
              return { field, operator, value: true };
            }
            if (value === 'false') {
              return { field, operator, value: false };
            }

            return { field, operator, value } as any;
          })
          .filter(f => f !== null);
      }

      // Include: parse "include" parameter (e.g. "jobListing")
      let include;
      const includeStr = params.get('include');
      if (includeStr) {
        include = includeStr.split(',').map(item => item.split(':')[1]);
      }

      // Merge with initialQuery (URL params take precedence)
      return {
        ...baseQuery,
        filters: filters || baseQuery.filters,
        include,
        pagination,
        sort: sort || baseQuery.sort,
      } as ApiQuery<T, I>;
    },
    [],
  );

  // Build a simplified query string from an ApiQuery object.
  // Built manually (no URLSearchParams) so structural ":" and "," stay raw in
  // the URL and only value contents are percent-encoded (e.g. a "," inside a
  // value is "%2C", which round-trips through parseRawQueryString below).
  const buildApiQueryStringSimple = useCallback(
    (query: ApiQuery<T, I>): string => {
      const segments: string[] = [];

      if (query.pagination?.start && query.pagination.start !== 0) {
        segments.push(`start=${query.pagination.start}`);
      }
      if (query.pagination?.count && query.pagination.count !== 10) {
        segments.push(`count=${query.pagination.count}`);
      }

      // Sort: "field:direction" (comma separated)
      const sortParam =
        query.sort && query.sort.length > 0
          ? query.sort
              .map(s => `${String(s.field)}:${s.direction}`)
              .join(',')
          : 'createdAt:desc';
      segments.push(`sort=${sortParam}`);

      // Filters: "field:operator:value" (semicolon separated). "," is left raw
      // inside values so multi-value "in" filters read cleanly in the URL bar.
      if (query.filters && query.filters.length > 0) {
        const filterParam = query.filters
          .map(
            f =>
              `${String(f.field)}:${f.operator}:${encodeFilterValue(f.value.toString())}`,
          )
          .join(';');
        segments.push(`filter=${filterParam}`);
      }

      if (query.include) {
        const includeParam = Object.keys(query.include).join(',');
        segments.push(`include=${includeParam}`);
      }

      return segments.join('&');
    },
    [],
  );

  // Parse initial URL state. Read the raw query string from window.location
  // (client-only) so we don't lose the structural difference between value
  // commas (encoded as "%2C") and filter-list commas (raw ",") that
  // URLSearchParams would collapse.
  const parseSearchParams = useCallback((): ApiQuery<T, I> => {
    void searchParams; // re-fire whenever Next.js sees the URL change
    const rawQs =
      typeof window !== 'undefined' ? window.location.search : '';
    return parseApiQueryFromSearchParams(rawQs, initialQuery);
  }, [parseApiQueryFromSearchParams, initialQuery, searchParams]);

  // Use the initialData (if provided) for the data state.
  const [query, setQuery] = useState<ApiQuery<T, I>>(parseSearchParams());

  // Sync query state if URL search params change externally.
  useEffect(() => {
    if (selfUpdating.current) {
      selfUpdating.current = false;
      return;
    }
    const newQuery = parseSearchParams();
    if (JSON.stringify(newQuery) !== JSON.stringify(query)) {
      setQuery(newQuery);
      fetchData();
    }
  }, [parseSearchParams, query]);

  // When query state changes, update the URL.
  useEffect(() => {
    const qs = buildApiQueryStringSimple(query);
    if (window.location.search !== `?${qs}`) {
      selfUpdating.current = true;
      router.replace(`${window.location.pathname}?${qs}`);
    }
  }, [query]);

  // Expose a function to update query state wrapped in a transition.
  const updateQuery = useCallback((newQuery: Partial<ApiQuery<T, I>>) => {
    startTransition(() => {
      setQuery(prev => ({ ...prev, ...newQuery }));
    });
  }, []);

  // Pagination helpers.
  const nextPage = useCallback(() => {
    startTransition(() => {
      setQuery(prev => {
        const current = prev.pagination || { count: 10, start: 0 };
        const newStart = (current.start ?? 0) + (current.count ?? 10);
        return { ...prev, pagination: { ...current, start: newStart } };
      });
    });
  }, []);

  const previousPage = useCallback(() => {
    startTransition(() => {
      setQuery(prev => {
        const current = prev.pagination || { count: 10, start: 0 };
        const newStart = Math.max(
          0,
          (current.start ?? 0) - (current.count ?? 10),
        );
        return { ...prev, pagination: { ...current, start: newStart } };
      });
    });
  }, []);

  const fetchData = useCallback(async () => {
    // startTransition(() => {
    setLoading(true);
    try {
      const qs = buildApiQueryStringSimple(query);
      const res = await fetch(`/api/data/${model}/report?${qs}`, {
        cache: 'no-store',
        next: {
          revalidate: 0,
          tags: [
            `user:${session.data?.user?.id}:report:${model}`,
            `user:${session.data?.user?.id}:report:${model}:${cacheKey}`,
          ],
        },
      });

      if (!res.ok) {
        throw new Error('Error fetching report data');
      }

      const json = await res.json();
      // if (!isEqual(json.data, data)) {
      setData(json.data);
      setTotalCount(json.pagination.total);
      setError(null);
      // }

      setLoading(false);
    } catch (err) {
      setError(err as Error);
      setData(null);
      setLoading(false);
    }
  }, [
    query,
    session.data?.user?.id,
    cacheKey,
    data,
    setData,
    setTotalCount,
    buildApiQueryStringSimple,
    model,
  ]);
  const canPreviousPage = (query.pagination?.start ?? 0) > 0;
  const canNextPage =
    (query.pagination?.start ?? 0) + (query.pagination?.count ?? 10) <
    totalCount;

  // Sync data state when initialData prop changes (e.g. after router.refresh())
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  // Only fetch data if we don't have initialData
  useEffect(() => {
    if (!initialData || initialData.length === 0) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTotalCount) {
      setTotalCount(initialTotalCount);
    }
  }, []);

  return {
    canNextPage,
    canPreviousPage,
    data,
    error,
    isPending,
    loading,
    nextPage,
    previousPage,
    query,
    totalCount,
    updateQuery,
  };
}

function parseRawQueryString(rawQueryString: string): Map<string, string> {
  const result = new Map<string, string>();
  const cleaned = rawQueryString.replace(/^\?/, '');
  if (!cleaned) return result;

  for (const pair of cleaned.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) {
      result.set(pair, '');
    } else {
      result.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }

  return result;
}

// Bookmarked URLs from before this hook moved to readable separators have
// "%3A" instead of raw ":" — decode once to recover the structural form.
function recoverStructuralForm(rawValue: string): string {
  if (rawValue.includes(':')) return rawValue;
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

// Encode a filter value but keep "," raw so multi-value "in" filters read
// cleanly. Inter-filter separator is ";", which encodeURIComponent does
// encode (to "%3B"), so a literal ";" in a value still survives parsing.
function encodeFilterValue(value: string): string {
  return encodeURIComponent(value).replace(/%2C/g, ',');
}

// Split the recovered filter string into individual "field:op:value" entries.
// New format uses ";" between filters. Old bookmarked URLs used "," — only
// treat "," as a separator when every chunk parses as a complete triple.
function splitFilterEntries(recovered: string): string[] {
  if (recovered.includes(';')) {
    return recovered.split(';');
  }
  const commaParts = recovered.split(',');
  const looksLikeOldMultiFilter =
    commaParts.length > 1 &&
    commaParts.every(part => part.split(':').length >= 3);
  return looksLikeOldMultiFilter ? commaParts : [recovered];
}
