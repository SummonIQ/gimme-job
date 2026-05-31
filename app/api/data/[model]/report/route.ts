// 'use cache';

import { unauthorized } from 'next/navigation';
import { NextRequest } from 'next/server';

import { getReportData } from '@/lib/reporting/data';
import { getSessionUser } from '@/lib/user/query';
import { ApiQuery, Filter, Operator } from '@/types/reporting/query';

// export const experimental_ppr = true;

// export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      model:
        | 'job-listings'
        | 'job-leads'
        | 'job-searches'
        | 'resumes'
        | 'applications';
    };
  },
) {
  // console.log('request', request);
  // 'use cache';
  const user = await getSessionUser();
  const { model } = await params;

  // cacheTag(`user:${user.id}:report:${model}`);

  // Parse from the raw query string instead of URLSearchParams: the structural
  // ":" and "," separators stay raw in the URL and only value contents are
  // percent-encoded (e.g. "%2C" inside a value), which lets us tell value
  // commas apart from filter-list commas.
  const rawSearch = new URL(request.url).search;
  const searchParams = parseRawQueryString(rawSearch);

  if (!user || !user.id) {
    return unauthorized();
  }

  // Pagination: read 'start' and 'count' with defaults.
  const startStr = searchParams.get('start');
  const countStr = searchParams.get('count');
  const start = startStr ? parseInt(startStr) : 0;
  const count = countStr ? parseInt(countStr) : 10;
  const pagination = { count, start };

  // Sort: expected as "field:direction" (comma separated for multiple sorts)
  let sort;
  const sortStr = searchParams.get('sort');
  if (sortStr) {
    sort = recoverStructuralForm(sortStr).split(',').map(item => {
      const [field, direction] = item.split(':');
      return {
        direction: (direction || 'asc').toLowerCase() as 'asc' | 'desc',
        field,
      };
    });
  }

  // Include: expected as "field:include" (comma separated for multiple includes)
  let include;
  const includeStr = searchParams.get('include');
  if (includeStr) {
    include = includeStr.split(',').map(item => item.split(':')[1]);
  }

  // Filters: expected as "field:operator:value" (semicolon separated for multiple filters)
  let filters: Array<Filter<any>> = [];
  const filterStr = searchParams.get('filter');
  if (filterStr) {
    filters = splitFilterEntries(recoverStructuralForm(filterStr))
      .map(item => {
        const parts = item.split(':');
        if (parts.length < 3) return null;
        const field = parts[0];
        const operator = parts[1] as Operator;
        // In case the value contains colons, join the remaining parts.
        const value = decodeURIComponent(parts.slice(2).join(':'));
        if (value === 'true') {
          return { field, operator, value: true };
        }
        if (value === 'false') {
          return { field, operator, value: false };
        }
        if (value === 'null') {
          return { field, operator, value: null };
        }

        return { field, operator, value };
      })
      .filter(f => f !== null);
  }

  const apiQuery: ApiQuery<any, any> = {
    filters,
    include,
    pagination,
    sort,
    userId: user.id,
  };

  const result = await getReportData({ apiQuery, model, userId: user.id });

  return Response.json(result);
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

// Bookmarked URLs from before this route moved to readable separators have
// "%3A" instead of raw ":" — decode once to recover the structural form.
function recoverStructuralForm(rawValue: string): string {
  if (rawValue.includes(':')) return rawValue;
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
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
