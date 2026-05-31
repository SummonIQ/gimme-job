// Remove the 'server-only' import which causes issues with client components
// Add runtime check to prevent client-side execution where inappropriate
const isClient = typeof window !== 'undefined';
if (isClient) {
  console.warn(
    'Auth server module should not be imported directly on the client',
  );
}

import { betterAuth, BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import { db } from '@/lib/db/client';

const LOCAL_DEV_AUTH_PORT = process.env.PORT ?? '10100';
const LOCAL_DEV_AUTH_ORIGIN = `http://localhost:${LOCAL_DEV_AUTH_PORT}`;
const LOCAL_DEV_TRUSTED_ORIGINS = [
  LOCAL_DEV_AUTH_ORIGIN,
  `http://127.0.0.1:${LOCAL_DEV_AUTH_PORT}`,
] as const;

export const config: BetterAuthOptions = {
  appName: 'Gimme Job',
  baseURL:
    process.env.NODE_ENV === 'production'
      ? process.env.BETTER_AUTH_URL
      : LOCAL_DEV_AUTH_ORIGIN,
  advanced: {
    cookiePrefix: 'gimme-job',
    disableCSRFCheck: false,
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),
  logger: {
    disabled: process.env.NODE_ENV === 'production', // Disable logging in production to avoid pino overhead
    level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  },
  databaseHooks: {
    // account: {
    //   // Account hooks
    // },
    // session: {
    //   // Session hooks
    // },
    user: {
      create: {
        after: async user => {
          const userId = user.id;

          await db.userProfile.create({
            data: {
              userId,
            },
          });

          await db.userJobPreferences.create({
            data: {
              userId,
            },
          });

          // Perform actions after user creation
        },
        // before: async user => {
        //   // Modify user data before creation
        //   // return { data: { ...user, customField: 'value' } };
        // },
      },
      update: {
        // after: async user => {
        //   // Perform actions after user update
        // },
        // before: async userData => {
        //   // Modify user data before update
        //   // return { data: { ...userData, updatedAt: new Date() } };
        // },
      },
    },
    verification: {
      // Verification hooks
    },
  },
  emailAndPassword: {
    autoSignIn: true,
    enabled: true,
    maxPasswordLength: 20,
    minPasswordLength: 8,
  },
  session: {
    cookieCache: {
      enabled: true, // Enable caching session in cookie
      maxAge: 7 * 24 * 60 * 60, // 7 days (full session length)
    },
    expiresIn: 7 * 24 * 60 * 60,
    // Force session to last 7 days (in seconds)
    freshAge: 7 * 24 * 60 * 60,
    // Update session every day to keep it active
    preserveSessionInDatabase: false, // Preserve session records in database when deleted from secondary storage (default: `false`)
    updateAge: 24 * 60 * 60,
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV !== 'production'
      ? [
          ...LOCAL_DEV_TRUSTED_ORIGINS,
          'exp://localhost:8081',
          'exp://127.0.0.1:8081',
        ]
      : []),
    'gimmejob://',
    'https://gimmejob.com',
    'https://www.gimmejob.com',
  ],
  user: {
    additionalFields: {
      // defaultResumeId: {
      //   required: false,
      //   type: 'string',
      // },
      // defaultRevisionId: {
      //   required: false,
      //   type: 'string',
      // },
      firstName: {
        required: true,
        type: 'string',
      },
      lastName: {
        required: true,
        type: 'string',
      },
    },
    modelName: 'user',
  },
  // You can add additional configurations (e.g. 2FA, rate limiter) here.
};

export const auth = betterAuth(config);
