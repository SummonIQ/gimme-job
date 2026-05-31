import { gunzipSync } from 'node:zlib';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const DEFAULT_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUS_CODES = new Set([403, 429, 502, 503, 504]);

export interface FetchAtsOptions {
  body?: BodyInit | null;
  headers?: HeadersInit;
  method?: string;
  slug: string;
  url: string;
}

export interface ScraperErrorOptions {
  cause?: unknown;
  slug: string;
  status?: number;
  url: string;
}

export class ScraperError extends Error {
  readonly slug: string;
  readonly status?: number;
  readonly url: string;

  constructor(message: string, options: ScraperErrorOptions) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'ScraperError';
    this.slug = options.slug;
    this.status = options.status;
    this.url = options.url;
  }
}

export const fetchAtsJson = async <T>({
  body,
  headers,
  method = 'GET',
  slug,
  url,
}: FetchAtsOptions): Promise<T> => {
  const text = await fetchAtsText({
    body,
    defaultAccept: 'application/json, text/plain, */*',
    headers,
    method,
    slug,
    url,
  });

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ScraperError('Failed to parse JSON response', {
      cause: error,
      slug,
      status: 200,
      url,
    });
  }
};

export const fetchAtsHtml = async ({
  body,
  headers,
  method = 'GET',
  slug,
  url,
}: FetchAtsOptions): Promise<string> =>
  fetchAtsText({
    body,
    defaultAccept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    headers,
    method,
    slug,
    url,
  });

const fetchAtsText = async ({
  body,
  defaultAccept,
  headers,
  method,
  slug,
  url,
}: FetchAtsOptions & { defaultAccept: string }): Promise<string> => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        body,
        headers: buildHeaders(defaultAccept, headers),
        method,
        signal: controller.signal,
      });

      const shouldRetry =
        RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES;
      if (shouldRetry) {
        await waitForRetry({ attempt: attempt + 1, response });
        continue;
      }

      if (!response.ok) {
        throw new ScraperError('ATS request failed', {
          slug,
          status: response.status,
          url,
        });
      }

      const compressedBody = await readBodyWithCap({ response, slug, url });
      const decodedBody = decodeBody({
        bytes: compressedBody,
        contentEncoding: response.headers.get('content-encoding'),
        slug,
        status: response.status,
        url,
      });

      return new TextDecoder().decode(decodedBody);
    } catch (error) {
      const canRetry = attempt < MAX_RETRIES;
      if (!canRetry) {
        if (error instanceof ScraperError) {
          throw error;
        }

        throw new ScraperError('ATS request failed', {
          cause: error,
          slug,
          url,
        });
      }

      await waitForRetry({ attempt: attempt + 1 });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ScraperError('ATS request exhausted retries', {
    slug,
    url,
  });
};

const buildHeaders = (
  defaultAccept: string,
  headers?: HeadersInit,
): HeadersInit => ({
  Accept: defaultAccept,
  'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
  'User-Agent': DEFAULT_USER_AGENT,
  ...headers,
});

const waitForRetry = async ({
  attempt,
  response,
}: {
  attempt: number;
  response?: Response;
}): Promise<void> => {
  const retryAfterSeconds = parseRetryAfterHeader(response?.headers.get('Retry-After'));
  if (retryAfterSeconds !== null) {
    await sleep(retryAfterSeconds * 1000);
    return;
  }

  await sleep((1.5 ** attempt) * 1000);
};

const parseRetryAfterHeader = (
  headerValue: string | null | undefined,
): number | null => {
  if (!headerValue) return null;
  if (!/^\d+$/.test(headerValue.trim())) return null;

  const parsed = Number.parseInt(headerValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const readBodyWithCap = async ({
  response,
  slug,
  url,
}: {
  response: Response;
  slug: string;
  url: string;
}): Promise<Uint8Array> => {
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalSize += value.byteLength;
    if (totalSize > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ScraperError('ATS response exceeded 10MB body cap', {
        slug,
        status: response.status,
        url,
      });
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
};

const decodeBody = ({
  bytes,
  contentEncoding,
  slug,
  status,
  url,
}: {
  bytes: Uint8Array;
  contentEncoding: string | null;
  slug: string;
  status: number;
  url: string;
}): Uint8Array => {
  const encoding = (contentEncoding ?? '').toLowerCase();
  if (!encoding.includes('gzip')) return bytes;

  try {
    const decompressed = gunzipSync(Buffer.from(bytes));
    return new Uint8Array(decompressed);
  } catch (error) {
    throw new ScraperError('Failed to decode gzip response body', {
      cause: error,
      slug,
      status,
      url,
    });
  }
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export const atsHttpConfig = {
  DEFAULT_ACCEPT_LANGUAGE,
  DEFAULT_USER_AGENT,
  MAX_BODY_BYTES,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  RETRYABLE_STATUS_CODES,
} as const;
