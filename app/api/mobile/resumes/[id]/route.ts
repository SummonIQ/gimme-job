import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const resume = await db.resume.findFirst({
      where: { id, userId: user.id },
      include: {
        analysis: true,
        revisions: {
          orderBy: { createdAt: 'desc' },
          include: {
            optimization: {
              select: {
                changelog: true,
                score: true,
                scoreImprovement: true,
                status: true,
                summary: true,
              },
            },
          },
        },
      },
    });

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    return NextResponse.json(resume);
  } catch (error) {
    console.error('Failed to get resume:', error);
    return NextResponse.json(
      { error: 'Failed to get resume' },
      { status: 500 },
    );
  }
}
