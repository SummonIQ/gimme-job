import { cn } from '@/lib/css';

interface ResumeMarkdownDiffProps {
  optimizedMarkdown: string;
  originalMarkdown: string;
}

interface DiffLine {
  afterLineNumber?: number;
  beforeLineNumber?: number;
  type: 'add' | 'remove' | 'same';
  value: string;
}

interface WordSegment {
  type: 'add' | 'remove' | 'same';
  value: string;
}

interface ModifyLine {
  afterLineNumber?: number;
  beforeLineNumber?: number;
  segments: WordSegment[];
  type: 'modify';
}

interface OmittedDiffLines {
  count: number;
  type: 'omitted';
}

type RenderDiffLine = DiffLine | ModifyLine | OmittedDiffLines;

const getLineDiff = (before: string, after: string): DiffLine[] => {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const rowCount = beforeLines.length;
  const columnCount = afterLines.length;
  const dp: number[][] = Array.from({ length: rowCount + 1 }, () =>
    Array(columnCount + 1).fill(0),
  );

  for (let i = 1; i <= rowCount; i += 1) {
    for (let j = 1; j <= columnCount; j += 1) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diffs: DiffLine[] = [];
  let i = rowCount;
  let j = columnCount;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      diffs.push({
        afterLineNumber: j,
        beforeLineNumber: i,
        type: 'same',
        value: beforeLines[i - 1],
      });
      i -= 1;
      j -= 1;
      continue;
    }

    if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffs.push({
        afterLineNumber: j,
        type: 'add',
        value: afterLines[j - 1],
      });
      j -= 1;
      continue;
    }

    if (i > 0) {
      diffs.push({
        beforeLineNumber: i,
        type: 'remove',
        value: beforeLines[i - 1],
      });
      i -= 1;
    }
  }

  return diffs.reverse();
};

const addContextToDiff = (
  lines: DiffLine[],
  contextSize: number = 2,
): RenderDiffLine[] => {
  const include = Array(lines.length).fill(false);

  lines.forEach((line, index) => {
    if (line.type === 'same') return;
    const start = Math.max(0, index - contextSize);
    const end = Math.min(lines.length - 1, index + contextSize);

    for (let pointer = start; pointer <= end; pointer += 1) {
      include[pointer] = true;
    }
  });

  if (!include.some(Boolean)) {
    return lines;
  }

  const rendered: RenderDiffLine[] = [];
  let omittedCount = 0;

  include.forEach((visible, index) => {
    if (!visible) {
      omittedCount += 1;
      return;
    }

    if (omittedCount > 0) {
      rendered.push({ count: omittedCount, type: 'omitted' });
      omittedCount = 0;
    }

    rendered.push(lines[index]);
  });

  if (omittedCount > 0) {
    rendered.push({ count: omittedCount, type: 'omitted' });
  }

  return rendered;
};

const getWordDiff = (before: string, after: string): WordSegment[] => {
  // Tokenize by splitting on whitespace boundaries, keeping separators
  const beforeTokens = before.split(/(\s+)/);
  const afterTokens = after.split(/(\s+)/);
  const m = beforeTokens.length;
  const n = afterTokens.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (beforeTokens[i - 1] === afterTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const segments: WordSegment[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeTokens[i - 1] === afterTokens[j - 1]) {
      segments.push({ type: 'same', value: beforeTokens[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      segments.push({ type: 'add', value: afterTokens[j - 1] });
      j -= 1;
    } else if (i > 0) {
      segments.push({ type: 'remove', value: beforeTokens[i - 1] });
      i -= 1;
    }
  }

  return segments.reverse();
};

/**
 * Post-process render lines: pair consecutive remove+add lines into single
 * "modify" lines with word-level diff segments.
 */
const pairInlineChanges = (lines: RenderDiffLine[]): RenderDiffLine[] => {
  const result: RenderDiffLine[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];

    // Collect consecutive removes
    if (line.type === 'remove') {
      const removes: DiffLine[] = [];
      while (idx < lines.length && lines[idx].type === 'remove') {
        removes.push(lines[idx] as DiffLine);
        idx += 1;
      }

      // Collect consecutive adds that follow
      const adds: DiffLine[] = [];
      while (idx < lines.length && lines[idx].type === 'add') {
        adds.push(lines[idx] as DiffLine);
        idx += 1;
      }

      // Pair up removes and adds into modify lines
      const pairs = Math.min(removes.length, adds.length);
      for (let p = 0; p < pairs; p += 1) {
        result.push({
          afterLineNumber: adds[p].afterLineNumber,
          beforeLineNumber: removes[p].beforeLineNumber,
          segments: getWordDiff(removes[p].value, adds[p].value),
          type: 'modify',
        });
      }

      // Leftover unpaired removes
      for (let p = pairs; p < removes.length; p += 1) {
        result.push(removes[p]);
      }

      // Leftover unpaired adds
      for (let p = pairs; p < adds.length; p += 1) {
        result.push(adds[p]);
      }

      continue;
    }

    result.push(line);
    idx += 1;
  }

  return result;
};

const ResumeMarkdownDiff = ({
  optimizedMarkdown,
  originalMarkdown,
}: ResumeMarkdownDiffProps) => {
  const lineDiff = getLineDiff(originalMarkdown, optimizedMarkdown);
  const contextLines = addContextToDiff(lineDiff);
  const renderLines = pairInlineChanges(contextLines);

  const additions = lineDiff.filter(line => line.type === 'add').length;
  const removals = lineDiff.filter(line => line.type === 'remove').length;
  const isIdentical = additions === 0 && removals === 0;

  if (!originalMarkdown || !optimizedMarkdown) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        Diff is not available until both original and optimized markdown are ready.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="rounded-md border border-green-500/25 bg-green-500/10 px-2 py-1 font-medium text-green-500">
          +{additions} additions
        </span>
        <span className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 font-medium text-red-500">
          -{removals} removals
        </span>
        {isIdentical ? (
          <span className="rounded-md border border-border/70 bg-background px-2 py-1 font-medium">
            No textual changes detected
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-md border border-border/70 bg-background">
        <div className="grid grid-cols-[3.5rem_3.5rem_1fr] border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Old</span>
          <span>New</span>
          <span>Content</span>
        </div>

        <div>
          {renderLines.map((line, index) => {
            if (line.type === 'omitted') {
              return (
                <div
                  className="border-b border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                  key={`omitted-${index}`}
                >
                  ... {line.count} unchanged lines omitted
                </div>
              );
            }

            if (line.type === 'modify') {
              return (
                <div
                  className="grid grid-cols-[3.5rem_3.5rem_1fr] border-b border-border/40 bg-yellow-500/[0.06] px-3 py-1.5 text-xs"
                  key={`line-${index}`}
                >
                  <span className="font-mono text-muted-foreground/80">
                    {line.beforeLineNumber ?? ''}
                  </span>
                  <span className="font-mono text-muted-foreground/80">
                    {line.afterLineNumber ?? ''}
                  </span>
                  <span className="whitespace-pre-wrap break-words font-mono text-foreground/85">
                    <span className="mr-2 select-none text-muted-foreground/70">
                      ~
                    </span>
                    {line.segments.map((seg, segIdx) => (
                      <span
                        className={cn(
                          seg.type === 'remove' &&
                            'rounded-sm bg-red-500/20 text-red-500 line-through',
                          seg.type === 'add' &&
                            'rounded-sm bg-green-500/20 text-green-500',
                        )}
                        key={segIdx}
                      >
                        {seg.value}
                      </span>
                    ))}
                  </span>
                </div>
              );
            }

            const marker =
              line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
            const content = line.value.length > 0 ? line.value : ' ';

            return (
              <div
                className={cn(
                  'grid grid-cols-[3.5rem_3.5rem_1fr] border-b border-border/40 px-3 py-1.5 text-xs',
                  line.type === 'add' && 'bg-green-500/10',
                  line.type === 'remove' && 'bg-red-500/10',
                  line.type === 'same' && 'bg-background',
                )}
                key={`line-${index}`}
              >
                <span className="font-mono text-muted-foreground/80">
                  {line.beforeLineNumber ?? ''}
                </span>
                <span className="font-mono text-muted-foreground/80">
                  {line.afterLineNumber ?? ''}
                </span>
                <span
                  className={cn(
                    'whitespace-pre-wrap break-words font-mono',
                    line.type === 'add' && 'text-green-500',
                    line.type === 'remove' && 'text-red-500 line-through',
                    line.type === 'same' && 'text-foreground/85',
                  )}
                >
                  <span className="mr-2 select-none text-muted-foreground/70">
                    {marker}
                  </span>
                  {content}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export { ResumeMarkdownDiff };
