import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { reason = 'Emergency stop triggered by user' } = body;

    // Update automation settings to pause
    const settings = await db.automationSettings.upsert({
      where: { userId: session.user.id },
      update: {
        isPaused: true,
        pausedAt: new Date(),
        pauseReason: reason,
        isEnabled: false,
      },
      create: {
        userId: session.user.id,
        isPaused: true,
        pausedAt: new Date(),
        pauseReason: reason,
        isEnabled: false,
      },
    });

    // Log emergency stop to audit log
    await db.automationAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'automation_paused',
        actionType: 'warning',
        metadata: {
          reason,
          trigger: 'emergency_stop',
        },
      },
    });

    // Cancel any pending application submissions
    // This would integrate with your queue system
    // For now, we'll mark any pending submissions as failed
    await db.applicationSubmission.updateMany({
      where: {
        userId: session.user.id,
        status: 'PENDING',
        wasAutomated: true,
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Automation stopped by user',
      },
    });

    return Response.json({
      success: true,
      settings,
      message: 'Automation has been stopped immediately',
    });
  } catch (error) {
    console.error('Error executing emergency stop:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}