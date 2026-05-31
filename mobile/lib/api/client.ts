import { API_BASE_URL } from '@/constants/config';
import { clearSessionToken, clearUserId, getSessionToken } from '@/lib/auth/session';
import { router } from 'expo-router';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

async function buildHeaders(
  customHeaders?: HeadersInit,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': API_BASE_URL,
  };

  const token = await getSessionToken();
  if (token) {
    headers['Cookie'] = `better-auth.session_token=${token}`;
  }

  if (customHeaders) {
    const entries =
      customHeaders instanceof Headers
        ? Array.from(customHeaders.entries())
        : Object.entries(customHeaders);
    for (const [key, value] of entries) {
      headers[key] = String(value);
    }
  }

  return headers;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, headers: customHeaders, ...fetchOptions } = options;
  const headers = await buildHeaders(customHeaders);
  const url = buildUrl(path, params);

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    await clearSessionToken();
    await clearUserId();
    router.replace('/(auth)/login');
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { error?: string }).error ||
        `Request failed: ${response.status}`,
    );
  }

  return response.json();
}

export const api = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return request<T>(path, { method: 'GET', params });
  },

  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'POST', body });
  },

  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PATCH', body });
  },

  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PUT', body });
  },

  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },

  /**
   * Raw fetch with auth headers — use for endpoints that don't return JSON
   * (e.g., auth sign-in where we need to read Set-Cookie headers).
   */
  async rawFetch(path: string, options: RequestOptions = {}): Promise<Response> {
    const { body, params, headers: customHeaders, ...fetchOptions } = options;
    const headers = await buildHeaders(customHeaders);
    const url = buildUrl(path, params);

    return fetch(url, {
      ...fetchOptions,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  },
};
