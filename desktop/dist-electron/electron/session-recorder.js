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
export function createSessionRecorder(config, deps) {
    const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxTransitions = config.maxTransitions ?? DEFAULT_MAX_TRANSITIONS;
    const maxScreenshots = config.maxScreenshots ?? DEFAULT_MAX_SCREENSHOTS;
    const now = deps.now ?? (() => new Date());
    const gzipFn = deps.gzip ?? ((buf) => gzipAsync(buf));
    const transitions = [];
    const fieldFills = [];
    const errors = [];
    let approxUncompressedSize = 0;
    let droppedTransitions = 0;
    let droppedFieldFills = 0;
    let finalized = false;
    const startedAt = now();
    const statsSnapshot = () => ({
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
                throw new Error(`session-recorder: finalize() called twice for session ${config.sessionId}`);
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
            const hasContent = transitions.length > 0 || fieldFills.length > 0 || errors.length > 0;
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
                throw new Error(`session-recorder: recordError() after finalize() for session ${config.sessionId}`);
            }
            errors.push({
                errorCode: input.errorCode ?? null,
                errorMessage: input.errorMessage,
                occurredAt: (input.occurredAt ?? now()).toISOString(),
            });
        },
        async recordFieldFill(input) {
            if (finalized) {
                throw new Error(`session-recorder: recordFieldFill() after finalize() for session ${config.sessionId}`);
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
                throw new Error(`session-recorder: recordTransition() after finalize() for session ${config.sessionId}`);
            }
            if (transitions.length >= maxTransitions) {
                droppedTransitions += 1;
                return;
            }
            const entry = {
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
export function createNoopArtifactWriter(prefix = 'noop-artifact-') {
    let counter = 0;
    return async () => {
        counter += 1;
        return { id: `${prefix}${counter}` };
    };
}
export function createInMemoryArtifactWriter(prefix = 'mem-artifact-') {
    const writes = [];
    let counter = 0;
    const writer = async (args) => {
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
export function createInMemoryScreenshotUploader(baseUrl = 'https://blob.test/screenshots/') {
    const seen = new Map();
    return async (png) => {
        const key = Buffer.from(png).toString('base64').slice(0, 16);
        if (seen.has(key))
            return seen.get(key);
        const url = `${baseUrl}${key}.png`;
        seen.set(key, url);
        return url;
    };
}
