import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { SafetyValidator } from '@/lib/automation/safety-validator';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    let settings = await db.automationSettings.findUnique({
      where: { userId: session.user.id },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await db.automationSettings.create({
        data: {
          userId: session.user.id,
        },
      });
    }

    return Response.json(settings);
  } catch (error) {
    console.error('Error fetching automation settings:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    
    // Remove fields that shouldn't be updated directly
    const { id, userId, createdAt, updatedAt, ...updateData } = body;

    // Get current settings for validation
    const currentSettings = await db.automationSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (currentSettings) {
      // Validate settings change using safety validator
      const validation = SafetyValidator.validateSettingsChange(currentSettings as any, updateData);
      if (!validation.allowed) {
        return Response.json(
          { error: validation.reason },
          { status: 400 }
        );
      }
    }

    // Log settings change to audit log
    await db.automationAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'settings_changed',
        actionType: 'success',
        metadata: {
          changes: updateData,
          previousSettings: currentSettings ? {
            requireUserApproval: currentSettings.requireUserApproval,
            preventDuplicateApplications: currentSettings.preventDuplicateApplications,
            isEnabled: currentSettings.isEnabled,
            isPaused: currentSettings.isPaused,
          } : null,
        },
      },
    });

    const settings = await db.automationSettings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    });

    return Response.json(settings);
  } catch (error) {
    console.error('Error updating automation settings:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}