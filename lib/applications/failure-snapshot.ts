import { put } from '@vercel/blob';
import { parse } from 'node-html-parser';

import { redactPiiValue } from '@/app/api/assist-mode/_lib/redact-pii';

const MAX_DOM_SNAPSHOT_BYTES = 500_000;
const REDACTED_VALUE = '[REDACTED]';

export interface FailureSnapshotPayload {
  readonly capturedAt?: string;
  readonly domHtml: string;
  readonly screenshotPngBase64: string;
}

export interface FailureSnapshotArtifacts {
  readonly capturedAt: string;
  readonly domByteSize: number;
  readonly domPathname: string;
  readonly domUrl: string;
  readonly screenshotByteSize: number;
  readonly screenshotPathname: string;
  readonly screenshotUrl: string;
}

export async function storeFailureSnapshotArtifacts(input: {
  readonly snapshot: FailureSnapshotPayload;
  readonly submissionId: string;
}): Promise<FailureSnapshotArtifacts> {
  const capturedAt = normalizeCapturedAt(input.snapshot.capturedAt);
  const screenshotBuffer = Buffer.from(
    input.snapshot.screenshotPngBase64,
    'base64',
  );
  const redactedHtml = redactFailureSnapshotHtml(input.snapshot.domHtml);
  const trimmedHtml = trimSnapshotHtml(redactedHtml);
  const basePath = `desktop-failure-snapshots/${input.submissionId}`;

  // Use `public` to match the connected blob store's configuration. The
  // store is provisioned as public; requesting `private` here threw the
  // "Cannot use private access on a public store" error on every failed
  // run. Snapshots are redacted via redactFailureSnapshotHtml above so PII
  // is already stripped before upload.
  const [screenshot, dom] = await Promise.all([
    put(`${basePath}/screenshot.png`, screenshotBuffer, {
      access: 'public',
      allowOverwrite: true,
      contentType: 'image/png',
    }),
    put(`${basePath}/dom.html`, trimmedHtml, {
      access: 'public',
      allowOverwrite: true,
      contentType: 'text/html; charset=utf-8',
    }),
  ]);

  return {
    capturedAt,
    domByteSize: Buffer.byteLength(trimmedHtml, 'utf8'),
    domPathname: dom.pathname,
    domUrl: dom.url,
    screenshotByteSize: screenshotBuffer.byteLength,
    screenshotPathname: screenshot.pathname,
    screenshotUrl: screenshot.url,
  };
}

export function redactFailureSnapshotHtml(html: string): string {
  const root = parse(html, {
    blockTextElements: {
      pre: true,
      script: true,
      style: true,
      textarea: false,
    },
  });

  for (const element of root.querySelectorAll('input')) {
    const value = element.getAttribute('value');
    if (value === undefined) continue;
    element.setAttribute(
      'value',
      redactFormValue({
        fieldLabel: readFieldLabel(element),
        fieldName: readFieldName(element),
        fieldType: element.getAttribute('type'),
        value,
      }),
    );
  }

  for (const element of root.querySelectorAll('textarea')) {
    const value = element.text;
    if (!value) continue;
    element.set_content(
      redactFormValue({
        fieldLabel: readFieldLabel(element),
        fieldName: readFieldName(element),
        value,
      }),
    );
  }

  return root.toString();
}

function redactFormValue(input: {
  readonly fieldLabel: string | null;
  readonly fieldName: string | null;
  readonly fieldType?: string | null;
  readonly value: string;
}): string {
  if (isAlwaysSensitiveField(input.fieldType, input.fieldName)) {
    return REDACTED_VALUE;
  }
  return (
    redactPiiValue(input.value, input.fieldLabel, input.fieldName) ??
    REDACTED_VALUE
  );
}

function isAlwaysSensitiveField(
  fieldType?: string | null,
  fieldName?: string | null,
): boolean {
  const type = fieldType?.toLowerCase() ?? '';
  if (type === 'hidden' || type === 'password') return true;
  return /token|secret|password|csrf|auth|session/i.test(fieldName ?? '');
}

function readFieldLabel(element: {
  readonly getAttribute: (name: string) => string | undefined;
}): string | null {
  return (
    element.getAttribute('aria-label') ??
    element.getAttribute('placeholder') ??
    element.getAttribute('data-label') ??
    null
  );
}

function readFieldName(element: {
  readonly getAttribute: (name: string) => string | undefined;
}): string | null {
  return (
    element.getAttribute('name') ??
    element.getAttribute('id') ??
    element.getAttribute('autocomplete') ??
    null
  );
}

function trimSnapshotHtml(html: string): string {
  if (Buffer.byteLength(html, 'utf8') <= MAX_DOM_SNAPSHOT_BYTES) return html;

  const marker = '\n<!-- trimmed: desktop failure DOM snapshot exceeded limit -->';
  let trimmed = html.slice(0, MAX_DOM_SNAPSHOT_BYTES - marker.length);
  while (
    Buffer.byteLength(`${trimmed}${marker}`, 'utf8') > MAX_DOM_SNAPSHOT_BYTES
  ) {
    trimmed = trimmed.slice(0, -1024);
  }
  return `${trimmed}${marker}`;
}

function normalizeCapturedAt(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : value;
}
