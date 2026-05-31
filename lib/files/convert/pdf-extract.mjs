/**
 * Standalone Node.js script for PDF text extraction.
 * Runs outside the Next.js bundler to avoid pdfjs-dist worker resolution issues.
 * Reads PDF bytes from stdin, writes extracted text to stdout.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const data = new Uint8Array(Buffer.concat(chunks));

const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;

const PAGE_LABEL_PATTERN = /^page\s+\d+(?:\s*(?:of|\/)\s*\d+)?$/i;
const PAGE_BREAK = '\n\n---\n\n';
const LINE_Y_TOLERANCE = 3;
const pages = [];

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const lines = [];

  for (const item of content.items.filter(item => 'str' in item)) {
    const value = item.str.trim();
    if (!value) continue;

    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    const line = lines.find(
      candidate => Math.abs(candidate.y - y) <= LINE_Y_TOLERANCE,
    );

    if (line) {
      line.items.push({ x, value });
    } else {
      lines.push({ y, items: [{ x, value }] });
    }
  }

  const pageText = lines
    .sort((a, b) => b.y - a.y)
    .map(line =>
      line.items
        .sort((a, b) => a.x - b.x)
        .map(item => item.value)
        .join(' ')
        .trim(),
    )
    .filter(line => line && !PAGE_LABEL_PATTERN.test(line))
    .join('\n');

  if (pageText.trim()) {
    pages.push(pageText.trim());
  }

  page.cleanup();
}

await doc.destroy();
process.stdout.write(pages.join(PAGE_BREAK));
