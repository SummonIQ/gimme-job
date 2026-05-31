import { ApiQuery } from '@/types/reporting/query';

export function buildApiQueryString<T, I>(query: ApiQuery<T, I>): string {
  const params = new URLSearchParams();

  // If pagination exists and has a 'count' property, set it separately.
  if (query.pagination?.count !== undefined) {
    params.set('count', query.pagination.count.toString());
  }

  // Also include the whole pagination object as a JSON string
  if (query.pagination) {
    params.set('pagination', JSON.stringify(query.pagination));
  }

  // Set filters if provided
  if (query.filters) {
    params.set('filters', JSON.stringify(query.filters));
  }

  // Set sort options if provided.
  // If you prefer to send this as 'sorts' change the key accordingly.
  if (query.sort) {
    params.set('sort', JSON.stringify(query.sort));
  }

  return params.toString();
}
