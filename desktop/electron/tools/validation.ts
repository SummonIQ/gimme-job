import type {
  ClickInput,
  CookiesGetInput,
  CookiesSetInput,
  DesktopCookie,
  DomSnapshotInput,
  FillInput,
  IdentityLoadInput,
  NavigateInput,
  NetworkObserveInput,
  NetworkReplayInput,
  PressKeyInput,
  ReadElementInput,
  ScreenshotRegionInput,
  ScrollIntoViewInput,
  SelectInput,
  SubmitGuardInput,
  UploadInput,
  WaitForInput,
} from './types.js';

const DEFAULT_WAIT_TIMEOUT_MS = 5_000;

export function parseNavigateInput(input: unknown): NavigateInput {
  const record = requireRecord(input);
  const url = requireHttpUrl(readRequiredString(record, 'url'), 'url');
  return { url };
}

export function parseWaitForInput(input: unknown): WaitForInput {
  const record = requireRecord(input);
  const selector = readOptionalString(record, 'selector');
  const text = readOptionalString(record, 'text');

  if (!selector && !text) {
    throw new Error('wait_for requires selector or text.');
  }

  return {
    selector,
    text,
    timeoutMs:
      readOptionalNumber(record, 'timeoutMs') ?? DEFAULT_WAIT_TIMEOUT_MS,
  };
}

export function parseDomSnapshotInput(_input: unknown): DomSnapshotInput {
  return {};
}

export function parseReadElementInput(input: unknown): ReadElementInput {
  return { selector: readSelector(input) };
}

export function parseClickInput(input: unknown): ClickInput {
  return { selector: readSelector(input) };
}

export function parseFillInput(input: unknown): FillInput {
  const record = requireRecord(input);
  return {
    selector: readRequiredString(record, 'selector'),
    value: readRequiredString(record, 'value'),
  };
}

export function parseSelectInput(input: unknown): SelectInput {
  const record = requireRecord(input);
  return {
    selector: readRequiredString(record, 'selector'),
    value: readRequiredString(record, 'value'),
  };
}

export function parseUploadInput(input: unknown): UploadInput {
  const record = requireRecord(input);
  return {
    filePath: readRequiredString(record, 'filePath'),
    selector: readRequiredString(record, 'selector'),
  };
}

export function parsePressKeyInput(input: unknown): PressKeyInput {
  const record = requireRecord(input);
  return { key: readRequiredString(record, 'key') };
}

export function parseScrollIntoViewInput(input: unknown): ScrollIntoViewInput {
  return { selector: readSelector(input) };
}

export function parseNetworkObserveInput(input: unknown): NetworkObserveInput {
  const record = requireRecord(input);
  return { enabled: readOptionalBoolean(record, 'enabled') ?? true };
}

export function parseNetworkReplayInput(input: unknown): NetworkReplayInput {
  const record = requireRecord(input);
  const headers = readOptionalStringRecord(record, 'headers') ?? {};

  return {
    body: readOptionalString(record, 'body'),
    headers,
    method: readOptionalString(record, 'method') ?? 'GET',
    url: requireHttpUrl(readRequiredString(record, 'url'), 'url'),
  };
}

export function parseCookiesGetInput(input: unknown): CookiesGetInput {
  const record = requireRecord(input);
  const url = readOptionalString(record, 'url');
  return url ? { url: requireHttpUrl(url, 'url') } : {};
}

export function parseCookiesSetInput(input: unknown): CookiesSetInput {
  const record = requireRecord(input);
  const cookiesValue = record.cookies;

  if (!Array.isArray(cookiesValue)) {
    throw new Error('cookies_set requires a cookies array.');
  }

  return {
    cookies: cookiesValue.map(parseCookie),
  };
}

export function parseScreenshotRegionInput(
  input: unknown,
): ScreenshotRegionInput {
  const record = requireRecord(input);
  return {
    height: readRequiredNumber(record, 'height'),
    width: readRequiredNumber(record, 'width'),
    x: readRequiredNumber(record, 'x'),
    y: readRequiredNumber(record, 'y'),
  };
}

export function parseIdentityLoadInput(input: unknown): IdentityLoadInput {
  const record = requireRecord(input);
  return { key: readRequiredString(record, 'key') };
}

export function parseSubmitGuardInput(input: unknown): SubmitGuardInput {
  const record = requireRecord(input ?? {});
  return { enabled: readOptionalBoolean(record, 'enabled') };
}

function parseCookie(value: unknown): DesktopCookie {
  const record = requireRecord(value);
  const cookie: DesktopCookie = {
    name: readRequiredString(record, 'name'),
    value: readRequiredString(record, 'value'),
  };
  const url = readOptionalString(record, 'url');
  const domain = readOptionalString(record, 'domain');
  const path = readOptionalString(record, 'path');
  const secure = readOptionalBoolean(record, 'secure');
  const httpOnly = readOptionalBoolean(record, 'httpOnly');
  const expirationDate = readOptionalNumber(record, 'expirationDate');

  if (url) cookie.url = requireHttpUrl(url, 'url');
  if (domain) cookie.domain = domain;
  if (path) cookie.path = path;
  if (secure !== undefined) cookie.secure = secure;
  if (httpOnly !== undefined) cookie.httpOnly = httpOnly;
  if (expirationDate !== undefined) cookie.expirationDate = expirationDate;

  return cookie;
}

function readSelector(input: unknown): string {
  return readRequiredString(requireRecord(input), 'selector');
}

function requireRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }

  return input as Record<string, unknown>;
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }

  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string.`);
  }

  return value;
}

function readRequiredNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number.`);
  }

  return value;
}

function readOptionalNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number.`);
  }

  return value;
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${key} must be a boolean.`);
  }

  return value;
}

function readOptionalStringRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, string> | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  const headers = requireRecord(value);
  return Object.fromEntries(
    Object.entries(headers).map(([entryKey, entryValue]) => {
      if (typeof entryValue !== 'string') {
        throw new Error(`${key}.${entryKey} must be a string.`);
      }

      return [entryKey, entryValue];
    }),
  );
}

function requireHttpUrl(value: string, key: string): string {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return value;
    }
  } catch {
    throw new Error(`${key} must be an http(s) URL.`);
  }

  throw new Error(`${key} must be an http(s) URL.`);
}
