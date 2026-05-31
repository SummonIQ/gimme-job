import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { lintMarkdown } from '../lint/markdown';

export async function convertPdfToMarkdown(input: Buffer): Promise<string> {
  // Run PDF extraction in a standalone Node.js process to avoid
  // Turbopack/webpack bundler issues with pdfjs-dist worker resolution.
  const scriptPath = fileURLToPath(new URL('./pdf-extract.mjs', import.meta.url).href);

  const result = execFileSync('node', [scriptPath], {
    input,
    encoding: 'utf-8',
    timeout: 60_000,
    maxBuffer: 20 * 1024 * 1024,
  });

  const text = result.trim();

  if (!text) {
    return '';
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return lintMarkdown(normalized);
}
