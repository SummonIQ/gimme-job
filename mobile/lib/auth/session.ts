import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'session_token';
const USER_ID_KEY = 'user_id';

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(USER_ID_KEY);
}

export async function setUserId(id: string): Promise<void> {
  await SecureStore.setItemAsync(USER_ID_KEY, id);
}

export async function clearUserId(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_ID_KEY);
}

/**
 * Extract the session token from a Set-Cookie header value.
 * Better Auth sets: better-auth.session_token=<value>;...
 * In production with secure cookies: __Secure-better-auth.session_token=<value>;...
 */
export function extractSessionToken(setCookieHeader: string): string | null {
  // Try direct session_token cookie
  const patterns = [
    /better-auth\.session_token=([^;]+)/,
    /__Secure-better-auth\.session_token=([^;]+)/,
  ];

  for (const pattern of patterns) {
    const match = setCookieHeader.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  // Fallback: extract from session_data cookie (base64 JSON containing the token)
  const dataMatch = setCookieHeader.match(/better-auth\.session_data=([^;]+)/);
  if (dataMatch?.[1]) {
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(dataMatch[1])));
      const token = decoded?.session?.session?.token;
      if (token) return token;
    } catch {
      // ignore parse errors
    }
  }

  return null;
}
