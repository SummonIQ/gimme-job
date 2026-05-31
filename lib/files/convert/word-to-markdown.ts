import * as mammoth from 'mammoth';
import { parse } from 'node-html-parser';

import { lintMarkdown } from '../lint/markdown';
import { convertHtmlToMarkdown } from './html-to-markdown';
import { createFileProcessingError } from '@/lib/errors';

interface convertOptions {
  mammoth?: { styleMap?: string[] } & Record<string, unknown>;
  turndown?: object;
}

const PAGE_BREAK_STYLE_MAP = ["br[type='page'] => hr"];

// Turndown will add an empty header if the first row
// of the table isn't `<th>` elements. This function
// converts the first row of a table to `<th>` elements
// so that it renders correctly in Markdown.
function autoTableHeaders(html: string): string {
  const root = parse(html);
  for (const table of root.querySelectorAll('table')) {
    const firstRow = table.querySelector('tr');

    if (firstRow) {
      for (const cell of firstRow.querySelectorAll('td')) {
        cell.tagName = 'th';
      }
    }
  }
  return root.toString();
}

export async function convertWordDocumentToMarkdown(
  input: Buffer,
  options: convertOptions = {},
): Promise<string> {
  if (!input || input.length === 0) {
    throw createFileProcessingError('Empty or invalid input buffer', {
      operation: 'convertWordDocumentToMarkdown',
      inputSize: input?.length || 0,
    });
  }

  try {
    const mammothResult = await mammoth.convertToHtml(
      { buffer: input },
      {
        ...options.mammoth,
        styleMap: [
          ...PAGE_BREAK_STYLE_MAP,
          ...(options.mammoth?.styleMap ?? []),
        ],
      },
    );

    if (!mammothResult.value) {
      throw createFileProcessingError(
        'Failed to extract content from Word document',
        {
          operation: 'mammoth.convertToHtml',
          hasMessages: mammothResult.messages?.length > 0,
          messages: mammothResult.messages,
        },
      );
    }

    const html = autoTableHeaders(mammothResult.value);
    const md = convertHtmlToMarkdown(html, { ...options.turndown });
    const cleanedMd = await lintMarkdown(md);

    if (!cleanedMd || cleanedMd.trim().length === 0) {
      throw createFileProcessingError('Conversion resulted in empty content', {
        operation: 'convertWordDocumentToMarkdown',
        originalHtmlLength: html?.length || 0,
        markdownLength: md?.length || 0,
      });
    }

    return cleanedMd;
  } catch (error) {
    if (error instanceof Error && error.name === 'AppError') {
      throw error;
    }

    throw createFileProcessingError(error, {
      operation: 'convertWordDocumentToMarkdown',
      inputSize: input.length,
      optionsProvided: Object.keys(options),
    });
  }
}
