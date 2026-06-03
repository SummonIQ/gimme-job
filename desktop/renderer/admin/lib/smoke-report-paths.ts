const SMOKE_TESTS_SEGMENT = '/Gimme Job/smoke-tests/';

export function isSmokeReportFilePath(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/');
  return (
    normalized.endsWith('.json') &&
    normalized.includes(SMOKE_TESTS_SEGMENT) &&
    !normalized.split('/').includes('..')
  );
}

export function filterSmokeReportFilePaths<T extends { readonly filePath: string }>(
  reports: readonly T[],
): readonly T[] {
  return reports.filter(report => isSmokeReportFilePath(report.filePath));
}
