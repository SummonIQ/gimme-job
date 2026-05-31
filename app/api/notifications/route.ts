import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  getUserNotifications,
  markNotificationAsRead,
} from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * GET handler for retrieving user notifications
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const { getCurrentUser } = await import('@/lib/user');
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const includeRead = url.searchParams.get('includeRead') === 'true';

  const result = await getUserNotifications(user!.id, {
    limit,
    offset,
    includeRead,
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
};

const markAsReadSchema = z.object({
  notificationId: z.string(),
});

/**
 * PATCH handler for marking notifications as read
 */
const handlePATCH = async (request: NextRequest): Promise<NextResponse> => {
  const { getCurrentUser } = await import('@/lib/user');
  const user = await getCurrentUser();
  requireAuth(user);

  const body = await request.json();

  const validation = markAsReadSchema.safeParse(body);
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

  await markNotificationAsRead(body.notificationId, user!.id);

  return NextResponse.json({
    success: true,
    message: 'Notification marked as read',
  });
};

export const GET = withApiErrorHandling(handleGET);
export const PATCH = withApiErrorHandling(handlePATCH);
