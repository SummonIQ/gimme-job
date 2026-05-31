import { md2docx } from '@adobe/helix-md2docx';

export async function convertMarkdownToWord(markdown: string) {
  const doc = await md2docx(markdown);
  return doc;
}
