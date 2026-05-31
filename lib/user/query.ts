// Use dynamic imports for server-only modules to prevent client-side errors
import { unstable_noStore } from 'next/cache';
import { unauthorized } from 'next/navigation';

import { A11Y_TEST_USER, isA11yTestMode } from '@/lib/a11y/test-mode';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';

/**
 * Get a user from the database by ID
 */
export async function getDatabaseUser(
  id: string,
  include?: {
    jobPreferences?: boolean;
    profile?: boolean;
  },
) {
  if (isA11yTestMode) {
    return {
      ...A11Y_TEST_USER,
      id,
      ...(include?.jobPreferences ? { jobPreferences: null } : {}),
      ...(include?.profile ? { profile: null } : {}),
    };
  }

  const user = await db.user.findUnique({
    include: include ?? {
      jobPreferences: false,
      profile: false,
    },
    where: {
      id,
    },
  });

  if (!user) {
    unauthorized();
  }

  return user;
}

/**
 * Get the currently authenticated user
 * Note: Cannot be cached as it accesses dynamic data via headers()
 */
export async function getCurrentUser({
  include,
}: {
  include?: {
    profile?: boolean;
  };
} = {}) {
  unstable_noStore(); // Mark as dynamic - accesses headers()

  if (isA11yTestMode) {
    return {
      ...A11Y_TEST_USER,
      ...(include?.profile ? { profile: null } : {}),
    };
  }

  try {
    const session = await auth.api.getSession({
      headers: await (await import('next/headers')).headers(),
    });

    if (!session || !session.user) {
      return null;
    }

    // Once we have the session, fetch the full user data
    const user = await db.user.findUnique({
      include: include ?? {
        profile: false,
      },
      where: {
        id: session.user.id,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    // Suppress expected prerender errors where headers() isn't available yet
    const errorMessage = error instanceof Error ? error.message : '';
    const isPrerenderError = errorMessage.includes('prerender') || errorMessage.includes('headers()');
    
    if (!isPrerenderError) {
      console.error('Authentication error:', error);
    }
    return null;
  }
}

/**
 * Get the current session user without full database user data
 * Note: Cannot be cached as it accesses dynamic data via headers()
 */
export async function getSessionUser() {
  unstable_noStore(); // Mark as dynamic - accesses headers()

  if (isA11yTestMode) {
    return {
      email: A11Y_TEST_USER.email,
      id: A11Y_TEST_USER.id,
      name: A11Y_TEST_USER.name,
    } as { email: string; id: string; name: string };
  }

  try {
    const session = await auth.api.getSession({
      headers: await (await import('next/headers')).headers(),
    });
    return session?.user;
  } catch (error) {
    // Suppress expected prerender errors where headers() isn't available yet
    const errorMessage = error instanceof Error ? error.message : '';
    const isPrerenderError = errorMessage.includes('prerender') || errorMessage.includes('headers()');
    
    if (!isPrerenderError) {
      console.error('Authentication error in getSessionUser:', error);
    }
    return null;
  }
}
