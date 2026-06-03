import { gunzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_SCREENSHOTS,
  DEFAULT_MAX_TRANSITIONS,
  createInMemoryArtifactWriter,
  createInMemoryScreenshotUploader,
  createNoopArtifactWriter,
  createSessionRecorder,
} from '../session-recorder.js';

function tinyPng(seed = 0): Buffer {
  // 8-byte marker + seed byte so uploader hashing makes each call distinct
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, seed & 0xff]);
}

describe('createSessionRecorder - happy path', () => {
  it('records transitions and field-fills, then finalizes one artifact', async () => {
    const uploader = createInMemoryScreenshotUploader();
    const { writer, writes } = createInMemoryArtifactWriter();
    const recorder = createSessionRecorder(
      { sessionId: 'session-happy' },
      { uploadScreenshot: uploader, writeArtifact: writer },
    );

    await recorder.recordTransition({
      domHtml: '<html><body><form id="f"></form></body></html>',
      node: 'contact',
      url: 'https://job-boards.greenhouse.io/fixture/jobs/1',
    });
    await recorder.recordFieldFill({
      fieldName: 'first_name',
      screenshotPng: tinyPng(1),
      selector: 'input#first_name',
      valueRedacted: '[REDACTED_IDENTITY]',
    });
    await recorder.recordTransition({
      domHtml: '<html><body><form id="f"><input/></form></body></html>',
      node: 'resume',
    });
    await recorder.recordFieldFill({
      fieldName: 'resume',
      screenshotPng: tinyPng(2),
      selector: 'input[type=file][name=resume]',
    });

    const result = await recorder.finalize();
    expect(result.emitted).toBe(true);
    expect(result.artifactId).toMatch(/^mem-artifact-/);
    expect(result.stats.transitionCount).toBe(2);
    expect(result.stats.fieldFillCount).toBe(2);
    expect(writes).toHaveLength(1);

    const row = writes[0];
    expect(row.sessionId).toBe('session-happy');
    expect(row.domSnapshotsMimeType).toBe('application/gzip');
    expect(row.screenshotUrls).toHaveLength(2);
    expect(row.screenshotUrls[0]).toMatch(/^https:\/\/blob\.test\/screenshots\//);
    expect(row.sizeBytes).toBeGreaterThan(0);

    // The gzipped DOM bundle decompresses to the transition JSON array.
    const decoded = JSON.parse(
      gunzipSync(row.domSnapshots).toString('utf8'),
    ) as Array<{ node: string }>;
    expect(decoded.map(t => t.node)).toEqual(['contact', 'resume']);

    const eventBundle = row.eventBundle as {
      transitions: unknown[];
      fieldFills: unknown[];
      mode: string;
      sessionId: string;
    };
    expect(eventBundle.sessionId).toBe('session-happy');
    expect(eventBundle.transitions).toHaveLength(2);
    expect(eventBundle.fieldFills).toHaveLength(2);
    expect(eventBundle.mode).toBe('training');
  });

  it('honors the submit mode override', async () => {
    const { writer, writes } = createInMemoryArtifactWriter();
    const recorder = createSessionRecorder(
      { mode: 'submit', sessionId: 's' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: writer,
      },
    );
    await recorder.recordTransition({ domHtml: '<html/>', node: 'n' });
    await recorder.finalize();
    const bundle = writes[0].eventBundle as { mode: string };
    expect(bundle.mode).toBe('submit');
  });
});

describe('createSessionRecorder - size/count caps', () => {
  it('drops transitions past maxTransitions', async () => {
    const { writer, writes } = createInMemoryArtifactWriter();
    const recorder = createSessionRecorder(
      { maxTransitions: 3, sessionId: 's' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: writer,
      },
    );
    for (let i = 0; i < 5; i += 1) {
      await recorder.recordTransition({
        domHtml: `<p>${i}</p>`,
        node: `n${i}`,
      });
    }
    const result = await recorder.finalize();
    expect(result.stats.transitionCount).toBe(3);
    expect(result.stats.droppedTransitionCount).toBe(2);
    const bundle = writes[0].eventBundle as { transitions: unknown[] };
    expect(bundle.transitions).toHaveLength(3);
  });

  it('drops field fills past maxScreenshots', async () => {
    const recorder = createSessionRecorder(
      { maxScreenshots: 2, sessionId: 's' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: createInMemoryArtifactWriter().writer,
      },
    );
    for (let i = 0; i < 4; i += 1) {
      await recorder.recordFieldFill({
        screenshotPng: tinyPng(i),
        selector: `#f${i}`,
      });
    }
    expect(recorder.stats.fieldFillCount).toBe(2);
    expect(recorder.stats.droppedFieldFillCount).toBe(2);
  });

  it('enforces maxBytes on accumulated DOM JSON', async () => {
    const recorder = createSessionRecorder(
      { maxBytes: 500, sessionId: 's' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: createInMemoryArtifactWriter().writer,
      },
    );
    const huge = 'x'.repeat(800);
    for (let i = 0; i < 5; i += 1) {
      await recorder.recordTransition({ domHtml: huge, node: `n${i}` });
    }
    expect(recorder.stats.transitionCount).toBeLessThan(5);
    expect(recorder.stats.droppedTransitionCount).toBeGreaterThan(0);
  });

  it('defaults are the published DEFAULT_ constants', () => {
    expect(DEFAULT_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(DEFAULT_MAX_TRANSITIONS).toBe(200);
    expect(DEFAULT_MAX_SCREENSHOTS).toBe(400);
  });
});

describe('createSessionRecorder - lifecycle guards', () => {
  it('does NOT emit an empty artifact unless forceEmit is set', async () => {
    const { writer, writes } = createInMemoryArtifactWriter();
    const recorder = createSessionRecorder(
      { sessionId: 'empty' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: writer,
      },
    );
    const result = await recorder.finalize();
    expect(result.emitted).toBe(false);
    expect(result.artifactId).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('forceEmit writes an empty artifact for audit', async () => {
    const { writer, writes } = createInMemoryArtifactWriter();
    const recorder = createSessionRecorder(
      { sessionId: 'empty-forced' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: writer,
      },
    );
    const result = await recorder.finalize({ forceEmit: true });
    expect(result.emitted).toBe(true);
    expect(writes).toHaveLength(1);
  });

  it('finalize can only be called once', async () => {
    const recorder = createSessionRecorder(
      { sessionId: 's' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: createInMemoryArtifactWriter().writer,
      },
    );
    await recorder.recordTransition({ domHtml: '<p/>', node: 'n' });
    await recorder.finalize();
    await expect(recorder.finalize()).rejects.toThrow(/finalize\(\) called twice/);
  });

  it('rejects recording after finalize', async () => {
    const recorder = createSessionRecorder(
      { sessionId: 's' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: createInMemoryArtifactWriter().writer,
      },
    );
    await recorder.finalize({ forceEmit: true });
    await expect(
      recorder.recordTransition({ domHtml: '<p/>', node: 'n' }),
    ).rejects.toThrow(/after finalize/);
    await expect(
      recorder.recordFieldFill({ screenshotPng: tinyPng(9), selector: '#x' }),
    ).rejects.toThrow(/after finalize/);
    expect(() =>
      recorder.recordError({ errorMessage: 'late' }),
    ).toThrow(/after finalize/);
  });
});

describe('createSessionRecorder - 10-minute session (acceptance)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces >=1 artifact row with non-empty snapshots over a simulated 10-minute session', async () => {
    const { writer, writes } = createInMemoryArtifactWriter();
    const recorder = createSessionRecorder(
      { sessionId: 'ten-min' },
      {
        uploadScreenshot: createInMemoryScreenshotUploader(),
        writeArtifact: writer,
      },
    );

    // Simulate 10 minutes of activity: a transition every minute, a
    // field fill every 90s, one error near the end.
    for (let minute = 0; minute < 10; minute += 1) {
      vi.setSystemTime(new Date(`2026-04-23T12:${String(minute).padStart(2, "0")}:00Z`));
      await recorder.recordTransition({
        domHtml: `<html><body><h1>Step ${minute}</h1></body></html>`,
        node: `step-${minute}`,
      });
      if (minute % 2 === 0) {
        await recorder.recordFieldFill({
          fieldName: `field_${minute}`,
          screenshotPng: tinyPng(minute),
          selector: `#field_${minute}`,
        });
      }
    }
    recorder.recordError({
      errorCode: 'VALIDATION',
      errorMessage: 'User missed a required field',
    });

    const result = await recorder.finalize();
    expect(result.emitted).toBe(true);
    expect(result.artifactId).not.toBeNull();
    expect(result.stats.transitionCount).toBe(10);
    expect(result.stats.fieldFillCount).toBe(5);
    expect(result.stats.errorCount).toBe(1);

    const row = writes[0];
    const decoded = JSON.parse(
      gunzipSync(row.domSnapshots).toString('utf8'),
    ) as Array<{ node: string; domHtml: string }>;
    expect(decoded).toHaveLength(10);
    for (const t of decoded) {
      expect(t.domHtml.length).toBeGreaterThan(10);
    }
    expect(row.screenshotUrls.length).toBe(5);
    expect(row.sizeBytes).toBeGreaterThan(0);
  });
});

describe('createNoopArtifactWriter', () => {
  it('returns deterministic-ish ids without persisting', async () => {
    const writer = createNoopArtifactWriter('noop-');
    const a = await writer({
      domSnapshots: Buffer.alloc(1),
      domSnapshotsMimeType: 'application/gzip',
      eventBundle: {},
      screenshotUrls: [],
      sessionId: 's1',
      sizeBytes: 1,
    });
    const b = await writer({
      domSnapshots: Buffer.alloc(1),
      domSnapshotsMimeType: 'application/gzip',
      eventBundle: {},
      screenshotUrls: [],
      sessionId: 's2',
      sizeBytes: 1,
    });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^noop-/);
  });
});

describe('createInMemoryScreenshotUploader', () => {
  it('deduplicates identical bytes and returns the same URL', async () => {
    const uploader = createInMemoryScreenshotUploader();
    const png = tinyPng(5);
    const u1 = await uploader(png);
    const u2 = await uploader(png);
    expect(u1).toBe(u2);
  });
});
