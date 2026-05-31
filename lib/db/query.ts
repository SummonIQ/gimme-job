import { Prisma } from '@/generated/prisma/browser';

import type { ApiQuery, Filter, Sort } from '@/types/reporting/query';

export function buildPrismaQuery<T, I>(query: ApiQuery<T, I>) {
  // Build where clause from filters
  const where = query.filters?.length
    ? {
        AND: query.filters.map((filter: Filter<T>) => {
          // Convert value based on operator and field type
          const processedValue =
            filter.value === 'true'
              ? true
              : filter.value === 'false'
                ? false
                : filter.value;

          switch (filter.operator) {
            case 'eq':
              return { [filter.field]: { equals: processedValue } };
            case 'contains':
              return {
                [filter.field]: {
                  contains: filter.value,
                  mode: 'insensitive',
                },
              };
            case 'gt':
              return { [filter.field]: { gt: filter.value } };
            case 'lt':
              return { [filter.field]: { lt: filter.value } };
            case 'gte':
              return { [filter.field]: { gte: filter.value } };
            case 'lte':
              return { [filter.field]: { lte: filter.value } };
            case 'in': {
              const values = Array.isArray(filter.value)
                ? filter.value
                : filter.value.split(',');
              return { [filter.field]: { in: values } };
            }
            default:
              return {};
          }
        }),
      }
    : undefined;

  const include = query.include as I;

  // Build orderBy with case-insensitive sorting for string fields
  const orderBy = query.sort?.map((sortItem: Sort<T>) => {
    const field = sortItem.field;

    // For string fields that should be sorted case-insensitively
    if (
      typeof field === 'string' &&
      ['title', 'company', 'description', 'status'].includes(field)
    ) {
      return {
        [field]: sortItem.direction.toLowerCase() as Prisma.SortOrder,
      };
    }

    // For other fields (dates, numbers, etc), use regular sorting
    return {
      [field]: sortItem.direction.toLowerCase() as Prisma.SortOrder,
    };
  });

  return {
    include,
    orderBy: orderBy?.[0],
    skip: query.pagination?.start,
    take: query.pagination?.count,
    where,
  };
}
