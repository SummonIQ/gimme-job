import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

const LOCAL_DEV_AUTH_ORIGIN = `http://localhost:${process.env.PORT ?? '10100'}`;

const resolvedBaseUrl =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_AUTH_URL
      : LOCAL_DEV_AUTH_ORIGIN;

export const authClient = createAuthClient({
  baseURL: resolvedBaseUrl,
  plugins: [
    inferAdditionalFields({
      user: {
        firstName: { type: 'string', required: true },
        lastName: { type: 'string', required: true },
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
