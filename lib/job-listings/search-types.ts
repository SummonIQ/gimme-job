export type JobSearchSort = 'recent' | 'oldest' | 'added' | 'company' | 'title';

export function isJobSearchSort(
  value: string | null | undefined,
): value is JobSearchSort {
  return (
    value === 'recent' ||
    value === 'oldest' ||
    value === 'added' ||
    value === 'company' ||
    value === 'title'
  );
}
