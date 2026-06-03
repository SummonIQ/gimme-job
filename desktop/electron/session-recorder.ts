import { gzip as gzipCb } from 'node:zlib';
import { promisify } from 'node:util';

/**
 * P6.2 - desktop session recorder.
 *
 * Buffers DOM snapshots (on transition) and screenshot URLs (on field
 * fill) into an in-memory bundle, then emits a single `ReplayArtifact`
 * row when the session finalizes. The recorder is intentionally pure of
 * DB access - it takes an injected `writeArtifact` dependency so the
 * Electron main process can wire it to a desktop-to-web API later (P5.4
 * token auth) without changing this module.
 *
 * Size cap enforcement: once the accumulated DOM snapshot JSON exceeds
 * `maxBytes`, further `recordTransition` calls are dropped with a
 * warning. Screenshots are bounded by count; the URLs (not the bytes)
 * are persisted so oversized PNGs don't bloat the DB row.
 */

const gzipAsync = promisify(gzipCb);

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_MAX_TRANSITIONS = 200;
export const DEFAULT_MAX_SCREENSHOTS = 400;

export interface WriteArtifactArgs {
  readonly sessionId: string;
  readonly domSnapshots: Buffer;
  readonly domSnapshotsMimeType: string;
  readonly screenshotUrls: readonly string[];
  readonly eventBundle: unknown;
  readonly sizeBytes: number;
}

export interface WriteArtifactResult {
  readonly id: string;
}

export type WriteArtifactFn = (
  args: WriteArtifactArgs,
) => Promise<WriteArtifactResult>;

export type UploadScreenshotFn = (png: Buffer) => Promise<string>;

export interface SessionRecorderDeps {
  /** Upload a PNG buffer and return a persistent URL. */
  readonly uploadScreenshot: UploadScreenshotFn;
  /** Persist the finalized artifact. */
  readonly writeArtifact: WriteArtifactFn;
  /** Time source; defaults to `new Date()`. Injectable for tests. */
  readonly now?: () => Date;
  /** Gzip function; defaults to node:zlib. Overridable for tests that want determinism. */
  readonly gzip?: (input: Uint8Array) => Promise<Buffer>;
}

export interface SessionRecorderConfig {
  readonly sessionId: string;
  readonly maxBytes?: number;
  readonly maxTransitions?: number;
  readonly maxScreenshots?: number;
  readonly mode?: 'training' | 'submit';
}

export interface RecordTransitionInput {
  readonly node: string;
  readonly url?: string;
  readonly domHtml: string;
  readonly occurredAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface RecordFieldFillInput {
  readonly selector: string;
  readonly fieldName?: string;
  readonly valueRedacted?: string;
  readonly screenshotPng: Buffer;
  readonly occurredAt?: Date;
}

export interface RecordErrorInput {
  readonly errorCode?: string;
  readonly errorMessage: string;
  readonly occurredAt?: Date;
}

interface TransitionEntry {
  readonly node: string;
  readonly url: string | null;
  readonly domHtml: string;
  readonly occurredAt: string;
  readonly metadata: Record<string, unknown> | null;
}

interface FieldFillEntry {
  readonly selector: string;
  readonly fieldName: string | null;
  readonly valueRedacted: string | null;
  readonly screenshotUrl: string;
  readonly occurredAt: string;
}

interface ErrorEntry {
  readonly errorCode: string | null;
  readonly errorMessage: string;
  readonly occurredAt: string;
}

export interface SessionRecorderStats {
  readonly transitionCount: number;
  readonly fieldFillCount: number;
  readonly errorCount: number;
  readonly droppedTransitionCount: number;
  readonly droppedFieldFillCount: number;
  readonly sizeBytes: number;
}

export interface FinalizeResult {
  readonly artifactId: string | null;
  readonly emitted: boolean;
  readonly stats: SessionRecorderStats;
  /** For logging / audit - raw JSON size of the DOM bundle pre-gzip. */
  readonly uncompressedBytes: number;
  readonly compressedBytes: number;
}

export interface SessionRecorder {
  recordTransition(input: RecordTransitionInput): Promise<void>;
  recordFieldFill(input: RecordFieldFillInput): Promise<void>;
  recordError(input: RecordErrorInput): void;
  finalize(opts?: { forceEmit?: boolean }): Promise<FinalizeResult>;
  readonly stats: SessionRecorderStats;
}

export function createSessionRecorder(
  config: SessionRecorderConfig,
  deps: SessionRecorderDeps,
): SessionRecorder {
  const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxTransitions = config.maxTransitions ?? DEFAULT_MAX_TRANSITIONS;
  const maxScreenshots = config.maxScreenshots ?? DEFAULT_MAX_SCREENSHOTS;
  const now = deps.now ?? (() => new Date());
  const gzipFn =
    deps.gzip ?? ((buf: Uint8Array) => gzipAsync(buf) as Promise<Buffer>);

  const transitions: TransitionEntry[] = [];
  const fieldFills: FieldFillEntry[] = [];
  const errors: ErrorEntry[] = [];
  let approxUncompressedSize = 0;
  let droppedTransitions = 0;
  let droppedFieldFills = 0;
  let finalized = false;
  const startedAt = now();

  const statsSnapshot = (): SessionRecorderStats => ({
    droppedFieldFillCount: droppedFieldFills,
    droppedTransitionCount: droppedTransitions,
    errorCount: errors.length,
    fieldFillCount: fieldFills.length,
    sizeBytes: approxUncompressedSize,
    transitionCount: transitions.length,
  });

  return {
    async finalize(opts = {}) {
      if (finalized) {
        throw new Error(
          `session-recorder: finalize() called twice for session ${config.sessionId}`,
        );
      }
      finalized = true;

      const eventBundle = {
        endedAt: now().toISOString(),
        errors,
        fieldFills,
        mode: config.mode ?? 'training',
        sessionId: config.sessionId,
        startedAt: startedAt.toISOString(),
        stats: statsSnapshot(),
        transitions,
      };

      const snapshotsJson = JSON.stringify(transitions);
      const uncompressedBytes = Buffer.byteLength(snapshotsJson, 'utf8');
      const compressed = await gzipFn(Buffer.from(snapshotsJson, 'utf8'));
      const compressedBytes = compressed.byteLength;

      const hasContent =
        transitions.length > 0 || fieldFills.length > 0 || errors.length > 0;
      if (!hasContent && !opts.forceEmit) {
        return {
          artifactId: null,
          compressedBytes,
          emitted: false,
          stats: statsSnapshot(),
          uncompressedBytes,
        };
      }

      const write = await deps.writeArtifact({
        domSnapshots: compressed,
        domSnapshotsMimeType: 'application/gzip',
        eventBundle,
        screenshotUrls: fieldFills.map(f => f.screenshotUrl),
        sessionId: config.sessionId,
        sizeBytes: compressedBytes,
      });

      return {
        artifactId: write.id,
        compressedBytes,
        emitted: true,
        stats: statsSnapshot(),
        uncompressedBytes,
      };
    },
    recordError(input) {
      if (finalized) {
        throw new Error(
          `session-recorder: recordError() after finalize() for session ${config.sessionId}`,
        );
      }
      errors.push({
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage,
        occurredAt: (input.occurredAt ?? now()).toISOString(),
      });
    },
    async recordFieldFill(input) {
      if (finalized) {
        throw new Error(
          `session-recorder: recordFieldFill() after finalize() for session ${config.sessionId}`,
        );
      }
      if (fieldFills.length >= maxScreenshots) {
        droppedFieldFills += 1;
        return;
      }
      const url = await deps.uploadScreenshot(input.screenshotPng);
      fieldFills.push({
        fieldName: input.fieldName ?? null,
        occurredAt: (input.occurredAt ?? now()).toISOString(),
        screenshotUrl: url,
        selector: input.selector,
        valueRedacted: input.valueRedacted ?? null,
      });
    },
    async recordTransition(input) {
      if (finalized) {
        throw new Error(
          `session-recorder: recordTransition() after finalize() for session ${config.sessionId}`,
        );
      }
      if (transitions.length >= maxTransitions) {
        droppedTransitions += 1;
        return;
      }
      const entry: TransitionEntry = {
        domHtml: input.domHtml,
        metadata: input.metadata ?? null,
        node: input.node,
        occurredAt: (input.occurredAt ?? now()).toISOString(),
        url: input.url ?? null,
      };
      const approxAdd = Buffer.byteLength(JSON.stringify(entry), 'utf8');
      if (approxUncompressedSize + approxAdd > maxBytes) {
        droppedTransitions += 1;
        return;
      }
      transitions.push(entry);
      approxUncompressedSize += approxAdd;
    },
    get stats() {
      return statsSnapshot();
    },
  };
}

/**
 * Safe no-op writer used by dev mode before the desktop-to-web API lands.
 * Returns a deterministic id but does not persist anywhere.
 */
export function createNoopArtifactWriter(
  prefix = 'noop-artifact-',
): WriteArtifactFn {
  let counter = 0;
  return async () => {
    counter += 1;
    return { id: `${prefix}${counter}` };
  };
}

/**
 * In-memory writer used by tests. Exposes the last-written bundle so
 * assertions can inspect the final row.
 */
export interface InMemoryArtifactWriter {
  readonly writer: WriteArtifactFn;
  readonly writes: readonly WriteArtifactArgs[];
}

export function createInMemoryArtifactWriter(
  prefix = 'mem-artifact-',
): InMemoryArtifactWriter {
  const writes: WriteArtifactArgs[] = [];
  let counter = 0;
  const writer: WriteArtifactFn = async args => {
    writes.push(args);
    counter += 1;
    return { id: `${prefix}${counter}` };
  };
  return { writer, writes };
}

/**
 * In-memory screenshot uploader used by tests. Returns a URL derived
 * from the content hash so duplicate uploads produce the same URL.
 */
export function createInMemoryScreenshotUploader(
  baseUrl = 'https://blob.test/screenshots/',
): UploadScreenshotFn {
  const seen = new Map<string, string>();
  return async png => {
    const key = Buffer.from(png).toString('base64').slice(0, 16);
    if (seen.has(key)) return seen.get(key) as string;
    const url = `${baseUrl}${key}.png`;
    seen.set(key, url);
    return url;
  };
}
