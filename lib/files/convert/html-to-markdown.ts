// @ts-expect-error - Package doesn't provide types
import TurndownService from '@joplin/turndown';
// @ts-expect-error - Package doesn't provide types
import * as turndownPluginGfm from '@joplin/turndown-plugin-gfm';

interface turndownOptions {
  bulletListMarker?: '*' | '-' | '+';
  codeBlockStyle?: 'indented' | 'fenced';
  headingStyle?: 'setext' | 'atx';
}

const defaultTurndownOptions: turndownOptions = {
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  headingStyle: 'atx',
};

// Convert HTML to GitHub-flavored Markdown
export function convertHtmlToMarkdown(
  html: string,
  options: object = {},
): string {
  const turndownService = new TurndownService({
    ...options,
    ...defaultTurndownOptions,
  });
  turndownService.use(turndownPluginGfm.gfm);
  turndownService.addRule('pageBreak', {
    filter: 'hr',
    replacement: () => '\n\n---\n\n',
  });
  return turndownService.turndown(html).trim();
}
