import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  getUserNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * GET handler for retrieving user notification preferences
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const { getCurrentUser } = await import('@/lib/user');
  const user = await getCurrentUser();
  requireAuth(user);

  const preferences = await getUserNotificationPreferences(user!.id);

  return NextResponse.json({
    success: true,
    data: preferences,
  });
};

const updatePreferencesSchema = z.object({
  applicationStatusEnabled: z.boolean().optional(),
  interviewRequestsEnabled: z.boolean().optional(),
  networkingRemindersEnabled: z.boolean().optional(),
  shareNotificationsEnabled: z.boolean().optional(),
  resumeFeedbackEnabled: z.boolean().optional(),
  systemNotificationsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  browserEnabled: z.boolean().optional(),
});

/**
 * PUT handler for updating notification preferences
 */
const handlePUT = async (request: NextRequest): Promise<NextResponse> => {
  const { getCurrentUser } = await import('@/lib/user');
  const user = await getCurrentUser();
  requireAuth(user);

  const body = await request.json();

  const validation = updatePreferencesSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid request data',
        errors: validation.error.format(),
      },
      { status: 400 },
    );
  }

  const updatedPreferences = await updateNotificationPreferences(
    user!.id,
    body,
  );

  return NextResponse.json({
    success: true,
    data: updatedPreferences,
    message: 'Notification preferences updated',
  });
};

export const GET = withApiErrorHandling(handleGET);
export const PUT = withApiErrorHandling(handlePUT);
