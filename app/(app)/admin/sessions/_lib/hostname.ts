export function getUrlHostname(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
