const PHONE_NUMBER_WITH_SPACED_HYPHENS_PATTERN =
  /(?<!\d)(\+?1[\s-]*)?(\(?\d{3}\)?)(?:\s*-\s*|\s+)(\d{3})(?:\s*-\s*|\s+)(\d{4})(?!\d)/g;
const PAGE_LABEL_LINE_PATTERN =
  /^\s{0,3}#{0,6}\s*(?:\*\*)?\s*page\s+\d+(?:\s*(?:of|\/)\s*\d+)?\s*(?:\*\*)?\s*$/gim;
const PAGE_BREAK = '\n\n---\n\n';

export function normalizeResumeMarkdown(markdown: string): string {
  return markdown
    .replace(PAGE_LABEL_LINE_PATTERN, PAGE_BREAK)
    .replace(/\n\s*---\s*\n(?:\s*---\s*\n)+/g, PAGE_BREAK)
    .replace(/^\s*---\s*/, '')
    .replace(/\s*---\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(
      PHONE_NUMBER_WITH_SPACED_HYPHENS_PATTERN,
      (
        _,
        countryCode: string | undefined,
        area: string,
        prefix: string,
        line: string,
      ) => {
        const normalizedCountryCode = countryCode
          ? `${countryCode.replace(/\s+/g, '').replace(/-+/g, '')}-`
          : '';

        return `${normalizedCountryCode}${area}-${prefix}-${line}`;
      },
    )
    .trim();
}
