'use server';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import {
  buildForwardingDestination,
  createCredential,
  createAlias,
  deleteAlias,
  generateAliasSlug,
  getAlias,
  getCredential,
  getTrackingEmail,
  getWebhookUrl,
  sanitizeTrackingAlias,
  updateAlias,
  validateTrackingAlias,
} from './improvmx';

interface SetupTrackingResult {
  alias?: string;
  canManageMailbox?: boolean;
  success: boolean;
  trackingEmail?: string;
  error?: string;
}

interface MailboxSetupResult {
  mailboxAddress?: string;
  password?: string;
  smtpHost?: string;
  smtpPort?: number;
  success: boolean;
  error?: string;
}

function generateMailboxPassword(): string {
  return `${crypto.randomUUID().replace(/-/g, '')}!Aa1`;
}

/**
 * Set up application tracking for the current user.
 * Creates an ImprovMX alias on gimmejob.com and stores it on the user record.
 */
export async function setupApplicationTracking(options?: {
  alias?: string;
  enableForwarding?: boolean;
}): Promise<SetupTrackingResult> {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const aliasSource =
      options?.alias ??
      user.trackingEmailAlias ??
      generateAliasSlug(
        user.firstName,
        user.id,
        user.email?.split('@')[0] ?? null,
      );
    const aliasSlug = sanitizeTrackingAlias(aliasSource);
    const aliasValidationError = validateTrackingAlias(aliasSlug);

    if (aliasValidationError) {
      return {
        success: false,
        error: aliasValidationError,
      };
    }

    if (user.trackingEmailAlias && aliasSlug === user.trackingEmailAlias) {
      return {
        alias: user.trackingEmailAlias,
        canManageMailbox: Boolean(process.env.IMPROVMX_API_KEY),
        success: true,
        trackingEmail: getTrackingEmail(user.trackingEmailAlias),
      };
    }

    const existingUserAlias = await db.user.findFirst({
      where: {
        id: { not: user.id },
        trackingEmailAlias: aliasSlug,
      },
      select: { id: true },
    });

    if (existingUserAlias) {
      return {
        success: false,
        error: 'That application email is already in use. Try another one.',
      };
    }

    const existingAlias = await getAlias(aliasSlug);
    if (existingAlias) {
      return {
        success: false,
        error: 'That application email is already reserved. Try another one.',
      };
    }

    const webhookUrl = getWebhookUrl();
    const forwardingEnabled =
      options?.enableForwarding ?? Boolean(user.trackingEmailForwardingEnabled);

    const forward = buildForwardingDestination({
      webhookUrl,
      userEmail: user.email,
      forwardingEnabled,
    });

    await createAlias(aliasSlug, forward);

    try {
      await db.user.update({
        where: { id: user.id },
        data: {
          trackingEmailAlias: aliasSlug,
          trackingEmailForwardingEnabled: forwardingEnabled,
          ...(user.trackingEmailAlias
            ? {}
            : { trackingEmailSetupAt: new Date() }),
        },
      });
    } catch (error) {
      await deleteAlias(aliasSlug).catch(deleteError => {
        console.warn(
          `[TRACKING SETUP] Failed to roll back alias ${aliasSlug}:`,
          deleteError,
        );
      });
      throw error;
    }

    if (user.trackingEmailAlias) {
      await deleteAlias(user.trackingEmailAlias).catch(error => {
        console.warn(
          `[TRACKING SETUP] Failed to delete old alias ${user.trackingEmailAlias}:`,
          error,
        );
      });
    }

    return {
      alias: aliasSlug,
      canManageMailbox: Boolean(process.env.IMPROVMX_API_KEY),
      success: true,
      trackingEmail: getTrackingEmail(aliasSlug),
    };
  } catch (error) {
    console.error('[TRACKING SETUP] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to set up tracking',
    };
  }
}

/**
 * Toggle email forwarding for the current user's tracking alias.
 */
export async function toggleTrackingEmailForwarding(
  enabled: boolean,
): Promise<SetupTrackingResult> {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!user.trackingEmailAlias) {
      return { success: false, error: 'Tracking email not set up' };
    }

    const webhookUrl = getWebhookUrl();
    const forward = buildForwardingDestination({
      webhookUrl,
      userEmail: user.email,
      forwardingEnabled: enabled,
    });

    await updateAlias(user.trackingEmailAlias, forward);

    await db.user.update({
      where: { id: user.id },
      data: {
        trackingEmailForwardingEnabled: enabled,
      },
    });

    return {
      alias: user.trackingEmailAlias,
      canManageMailbox: Boolean(process.env.IMPROVMX_API_KEY),
      success: true,
      trackingEmail: getTrackingEmail(user.trackingEmailAlias),
    };
  } catch (error) {
    console.error('[TRACKING FORWARDING] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update forwarding',
    };
  }
}

/**
 * Create SMTP credentials for the user's tracking address.
 * ImprovMX forwards inbound email, while these credentials let the user send
 * or reply from the same application email in their mail client.
 */
export async function createTrackingMailbox(): Promise<MailboxSetupResult> {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!user.trackingEmailAlias) {
      return {
        success: false,
        error:
          'Create your tracking email before creating mailbox credentials.',
      };
    }

    const mailboxAddress = getTrackingEmail(user.trackingEmailAlias);
    const existingCredential = await getCredential(mailboxAddress);

    if (existingCredential) {
      return {
        success: false,
        error: 'Mailbox credentials already exist for this application email.',
      };
    }

    const password = generateMailboxPassword();

    await createCredential(mailboxAddress, password);

    return {
      mailboxAddress,
      password,
      smtpHost: 'smtp.improvmx.com',
      smtpPort: 587,
      success: true,
    };
  } catch (error) {
    console.error('[TRACKING MAILBOX] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create mailbox credentials',
    };
  }
}
