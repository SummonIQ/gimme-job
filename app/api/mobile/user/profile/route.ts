import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser({ include: { profile: true } });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        jobPreferences: true,
        profile: true,
      },
    });

    return NextResponse.json(fullUser);
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return NextResponse.json(
      { error: 'Failed to get user profile' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { profile, jobPreferences, ...userData } = body;

    // Update user fields (firstName, lastName, etc.)
    if (Object.keys(userData).length > 0) {
      await db.user.update({
        where: { id: user.id },
        data: userData,
      });
    }

    // Update profile if provided
    if (profile) {
      await db.userProfile.upsert({
        where: { userId: user.id },
        create: { ...profile, userId: user.id },
        update: profile,
      });
    }

    // Update job preferences if provided
    if (jobPreferences) {
      await db.userJobPreferences.upsert({
        where: { userId: user.id },
        create: { ...jobPreferences, userId: user.id },
        update: jobPreferences,
      });
    }

    const updatedUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        jobPreferences: true,
        profile: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 },
    );
  }
}
