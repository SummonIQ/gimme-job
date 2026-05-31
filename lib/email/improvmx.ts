const IMPROVMX_API_URL = 'https://api.improvmx.com/v3';
const IMPROVMX_DOMAIN = 'gimmejob.com';
const IMPROVMX_WEBHOOK_PATH = '/api/webhooks/improvmx';
const DEFAULT_PUBLIC_APP_URL = 'https://www.gimmejob.com';
const TRACKING_ALIAS_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export interface ImprovMXAlias {
  alias: string;
  forward: string;
  id: number;
  created?: number;
}

export interface ImprovMXCredential {
  credential: string;
  id?: number;
  created?: number;
}

function getApiKey(): string {
  const key = process.env.IMPROVMX_API_KEY;
  if (!key) {
    throw new Error('IMPROVMX_API_KEY environment variable is not set');
  }
  return key;
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`api:${getApiKey()}`).toString('base64')}`;
}

interface ImprovMXResponse<T = unknown> {
  success: boolean;
  errors?: Record<string, string[]>;
  alias?: T;
  aliases?: T[];
  credential?: T;
  credentials?: T[];
}

export function isImprovMXConfigured(): boolean {
  return Boolean(process.env.IMPROVMX_API_KEY);
}

async function improvmxRequest<T = unknown>(
  path: string,
  options: RequestInit,
): Promise<ImprovMXResponse<T>> {
  const response = await fetch(`${IMPROVMX_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();
  const data = responseText
    ? (JSON.parse(responseText) as ImprovMXResponse<T>)
    : ({ success: response.ok } as ImprovMXResponse<T>);

  if (!response.ok || !data.success) {
    const errorMessages = data.errors
      ? Object.values(data.errors).flat().join(', ')
      : `HTTP ${response.status}`;
    throw new Error(`ImprovMX request failed: ${errorMessages}`);
  }

  return data;
}

/**
 * Create an email alias on the gimmejob.com domain via ImprovMX.
 *
 * @param alias - The alias part (e.g. "steven-abc123" for steven-abc123@gimmejob.com)
 * @param forward - Comma-separated list of forwarding destinations (webhook URLs and/or emails)
 */
export async function createAlias(
  alias: string,
  forward: string,
): Promise<ImprovMXAlias> {
  const data = await improvmxRequest<ImprovMXAlias>(
    `/domains/${IMPROVMX_DOMAIN}/aliases`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alias, forward }),
    },
  );

  if (!data.alias) {
    throw new Error('ImprovMX createAlias failed: missing alias response');
  }

  return data.alias;
}

/**
 * Update the forwarding destinations for an existing alias.
 */
export async function updateAlias(
  alias: string,
  forward: string,
): Promise<ImprovMXAlias> {
  const data = await improvmxRequest<ImprovMXAlias>(
    `/domains/${IMPROVMX_DOMAIN}/aliases/${alias}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ forward }),
    },
  );

  if (!data.alias) {
    throw new Error('ImprovMX updateAlias failed: missing alias response');
  }

  return data.alias;
}

/**
 * Delete an alias from the gimmejob.com domain.
 */
export async function deleteAlias(alias: string): Promise<void> {
  await improvmxRequest(`/domains/${IMPROVMX_DOMAIN}/aliases/${alias}`, {
    method: 'DELETE',
  });
}

/**
 * Get an existing alias.
 */
export async function getAlias(alias: string): Promise<ImprovMXAlias | null> {
  const response = await fetch(
    `${IMPROVMX_API_URL}/domains/${IMPROVMX_DOMAIN}/aliases/${alias}`,
    {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(),
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  const data = (await response.json()) as ImprovMXResponse<ImprovMXAlias>;

  if (!response.ok || !data.success) {
    return null;
  }

  return data.alias ?? null;
}

/**
 * Build the forwarding destination string for an alias.
 *
 * Returns just the webhook URL. We deliberately do not append the user's
 * personal email here — the alias should forward only to the webhook so the
 * destination string ends in "improvmx" (no trailing comma+email). If a user
 * still wants their inbound mail copied to their personal inbox they can do
 * that downstream of the webhook handler, not via ImprovMX's multi-forward.
 */
export function buildForwardingDestination(options: {
  webhookUrl: string;
  // Kept for backwards compatibility — both fields are intentionally ignored.
  userEmail?: string;
  forwardingEnabled?: boolean;
}): string {
  return options.webhookUrl;
}

/**
 * Get the webhook URL for the ImprovMX integration.
 */
export function getWebhookUrl(): string {
  const explicitWebhookUrl =
    process.env.IMPROVMX_WEBHOOK_URL ||
    process.env.APPLICATION_TRACKING_WEBHOOK_URL;

  if (explicitWebhookUrl) {
    const normalizedWebhookUrl = normalizePublicUrl(explicitWebhookUrl);

    if (!normalizedWebhookUrl) {
      throw new Error(
        'IMPROVMX_WEBHOOK_URL must be a public http(s) URL. Use a tunnel URL for local webhook testing.',
      );
    }

    return normalizedWebhookUrl.toString();
  }

  const appUrl =
    [
      process.env.APPLICATION_TRACKING_BASE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      getVercelUrl(),
      DEFAULT_PUBLIC_APP_URL,
    ]
      .map(normalizePublicUrl)
      .find((url): url is URL => Boolean(url)) ??
    new URL(DEFAULT_PUBLIC_APP_URL);

  return new URL(IMPROVMX_WEBHOOK_PATH, appUrl).toString();
}

function getVercelUrl(): string | undefined {
  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (!vercelUrl) {
    return undefined;
  }

  return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
}

function normalizePublicUrl(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    if (isLocalHost(url.hostname)) {
      return null;
    }

    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost') ||
    normalizedHostname === '0.0.0.0' ||
    normalizedHostname === '::1' ||
    normalizedHostname.startsWith('127.') ||
    normalizedHostname.startsWith('10.') ||
    normalizedHostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHostname)
  );
}

/**
 * Generate a unique alias slug from a user's first name and a short ID.
 */
export function generateAliasSlug(
  firstName: string | null | undefined,
  userId: string,
  fallback?: string | null,
): string {
  const sourceValue = firstName?.trim() || fallback?.trim() || 'applicant';
  const sanitized = sourceValue
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  const shortId = userId.slice(-6).toLowerCase();
  return `${sanitized}-${shortId}`;
}

export function sanitizeTrackingAlias(alias: string): string {
  return alias
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[._-]{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
}

export function validateTrackingAlias(alias: string): string | null {
  if (!alias) {
    return 'Choose an email name to continue.';
  }

  if (alias.length < 3) {
    return 'Use at least 3 characters.';
  }

  if (alias.length > 30) {
    return 'Use 30 characters or fewer.';
  }

  if (!TRACKING_ALIAS_PATTERN.test(alias)) {
    return 'Use lowercase letters, numbers, dots, dashes, or underscores.';
  }

  return null;
}

/**
 * Get the full tracking email address from an alias slug.
 */
export function getTrackingEmail(alias: string): string {
  return `${alias}@${IMPROVMX_DOMAIN}`;
}

export async function listCredentials(): Promise<ImprovMXCredential[]> {
  const data = await improvmxRequest<ImprovMXCredential>(
    `/domains/${IMPROVMX_DOMAIN}/credentials`,
    {
      method: 'GET',
    },
  );

  return data.credentials ?? [];
}

export async function getCredential(
  emailAddress: string,
): Promise<ImprovMXCredential | null> {
  const credentials = await listCredentials();
  return (
    credentials.find(
      credential =>
        credential.credential.toLowerCase() === emailAddress.toLowerCase(),
    ) ?? null
  );
}

export async function createCredential(
  emailAddress: string,
  password: string,
): Promise<ImprovMXCredential> {
  const data = await improvmxRequest<ImprovMXCredential>(
    `/domains/${IMPROVMX_DOMAIN}/credentials`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: emailAddress,
        password,
      }),
    },
  );

  if (!data.credential) {
    throw new Error(
      'ImprovMX createCredential failed: missing credential response',
    );
  }

  return data.credential;
}
