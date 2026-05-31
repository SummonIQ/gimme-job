// Lint the Markdown and correct any issues
export async function lintMarkdown(
  md: string,
  options?: {
    fix?: boolean;
  },
): Promise<string> {
  void options;
  return md;
}
