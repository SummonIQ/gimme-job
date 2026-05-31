import { API_BASE_URL } from '@/constants/config';
import {
  clearSessionToken,
  clearUserId,
  extractSessionToken,
  getSessionToken,
  setSessionToken,
  setUserId,
} from '@/lib/auth/session';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
}

interface BetterAuthResponse {
  user?: AuthUser;
  session?: { token: string; expiresAt?: string };
  token?: string;
}

function tryExtractToken(response: Response): string | null {
  // Try set-cookie header (works in some RN environments)
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const token = extractSessionToken(setCookie);
    if (token) return token;
  }

  // Try iterating all headers (some RN versions expose cookies this way)
  try {
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        const token = extractSessionToken(value);
        if (token) throw token; // abuse throw to break forEach
      }
    });
  } catch (token) {
    if (typeof token === 'string') return token;
  }

  return null;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': API_BASE_URL,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message || 'Sign in failed',
    );
  }

  const data = (await response.json()) as BetterAuthResponse;

  // Try getting token from response body first
  let token = data.session?.token || data.token || null;

  // Fallback: try Set-Cookie header
  if (!token) {
    token = tryExtractToken(response);
  }

  if (token) {
    await setSessionToken(token);
    console.log('[AUTH] Token saved successfully');
  } else {
    console.warn('[AUTH] No token found in response body or headers');
    console.log('[AUTH] Response keys:', JSON.stringify(Object.keys(data)));
    console.log('[AUTH] Session:', JSON.stringify(data.session));
    // Log all response headers for debugging
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k] = v; });
    console.log('[AUTH] Response headers:', JSON.stringify(headers));
  }

  if (data.user?.id) {
    await setUserId(data.user.id);
  }

  if (!data.user) {
    throw new Error('No user returned from sign in');
  }

  return data.user;
}

export async function signUp(params: {
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  password: string;
}): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': API_BASE_URL,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message || 'Sign up failed',
    );
  }

  const data = (await response.json()) as BetterAuthResponse;

  let token = data.session?.token || data.token || null;
  if (!token) {
    token = tryExtractToken(response);
  }

  if (token) {
    await setSessionToken(token);
  }

  if (data.user?.id) {
    await setUserId(data.user.id);
  }

  if (!data.user) {
    throw new Error('No user returned from sign up');
  }

  return data.user;
}

export async function validateSession(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `better-auth.session_token=${token}`,
        'Origin': API_BASE_URL,
      },
    });

    if (!response.ok) {
      await clearSessionToken();
      await clearUserId();
      return null;
    }

    const data = (await response.json()) as BetterAuthResponse;
    if (data.user) {
      await setUserId(data.user.id);
      return data.user;
    }

    await clearSessionToken();
    await clearUserId();
    return null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  const token = await getSessionToken();
  try {
    await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Cookie': `better-auth.session_token=${token}` } : {}),
        'Origin': API_BASE_URL,
      },
    });
  } catch {
    // Sign out locally even if the API call fails
  }
  await clearSessionToken();
  await clearUserId();
}
