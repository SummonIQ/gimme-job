import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if search exists and belongs to user
    const jobSearch = await db.jobSearch.findUnique({
      where: { id },
      select: { userId: true, saved: true },
    });

    if (!jobSearch) {
      return NextResponse.json(
        { error: 'Search not found' },
        { status: 404 }
      );
    }

    if (jobSearch.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update the search to mark as not saved (don't delete the record)
    await db.jobSearch.update({
      where: { id },
      data: { saved: false },
    });

    return NextResponse.json(
      { message: 'Search unsaved successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error unsaving job search:', error);
    return NextResponse.json(
      { error: 'Failed to unsave job search' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { saved } = body;

    // Check if search exists and belongs to user
    const jobSearch = await db.jobSearch.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!jobSearch) {
      return NextResponse.json(
        { error: 'Search not found' },
        { status: 404 }
      );
    }

    if (jobSearch.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update the saved status
    const updatedSearch = await db.jobSearch.update({
      where: { id },
      data: { saved: saved ?? true },
    });

    return NextResponse.json(updatedSearch, { status: 200 });
  } catch (error) {
    console.error('Error updating job search:', error);
    return NextResponse.json(
      { error: 'Failed to update job search' },
      { status: 500 }
    );
  }
}
