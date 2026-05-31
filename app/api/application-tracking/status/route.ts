import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import { getTrackingStatusForUser } from '@/lib/email/tracking';
import { NextRequest, NextResponse } from 'next/server';

const handleGET = async (_request: NextRequest): Promise<NextResponse> => {
  const { getCurrentUser } = await import('@/lib/user');
  const user = await getCurrentUser();
  requireAuth(user);

  const trackingStatus = await getTrackingStatusForUser(user!);

  return NextResponse.json(trackingStatus);
};

export const GET = withApiErrorHandling(handleGET);
