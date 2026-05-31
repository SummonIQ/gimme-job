'use client';

import { signOut } from '@/lib/auth/client';

const buildRedirectUrl = (baseUrl: string): string => {
  if (typeof window === 'undefined') return baseUrl;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const encodedPath = encodeURIComponent(currentPath);
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}redirect_url=${encodedPath}`;
};

export async function redirectIfUnauthorized(
  error: unknown,
  baseUrl: string = '/login',
): Promise<boolean> {
  const message: string =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';
  const normalized = message.toLowerCase();
  const shouldRedirect =
    normalized.includes('unauthorized') ||
    normalized.includes('not authenticated') ||
    normalized.includes('not logged in');

  if (!shouldRedirect) {
    return false;
  }

  try {
    await signOut();
  } catch {
    // ignore sign-out errors, still redirect
  }

  if (typeof window !== 'undefined') {
    window.location.href = buildRedirectUrl(baseUrl);
  }

  return true;
}
