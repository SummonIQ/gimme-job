export type CursorSort = 'recent-desc' | 'updated-asc';

export interface PageCursor {
  id: string;
  sort: CursorSort;
  timestamp: string;
}

export const encodeCursor = (cursor: PageCursor): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

export const decodeCursor = (
  rawCursor: string | null,
  expectedSort: CursorSort,
): PageCursor | null => {
  if (!rawCursor) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(rawCursor, 'base64url').toString('utf8'),
    ) as Partial<PageCursor>;

    if (
      parsed.sort !== expectedSort ||
      !parsed.id ||
      !parsed.timestamp ||
      Number.isNaN(Date.parse(parsed.timestamp))
    ) {
      return null;
    }

    return {
      id: parsed.id,
      sort: parsed.sort,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
};
