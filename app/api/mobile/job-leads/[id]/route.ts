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

    const lead = await db.jobLead.findFirst({
      where: { id, userId: user.id },
      include: {
        applicationSubmissions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        jobFitAnalysis: true,
        jobListing: true,
        optimization: {
          include: {
            jobFitAnalysis: true,
            resumeRevision: {
              select: {
                id: true,
                markdown: true,
                name: true,
                wordDocumentUrl: true,
              },
            },
          },
        },
        resumeRevisions: {
          select: {
            id: true,
            markdown: true,
            name: true,
            wordDocumentUrl: true,
            createdAt: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Job lead not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...lead,
      resumeRevisions: lead.resumeRevisions ? [lead.resumeRevisions] : [],
    });
  } catch (error) {
    console.error('Failed to get job lead:', error);
    return NextResponse.json(
      { error: 'Failed to get job lead' },
      { status: 500 },
    );
  }
}
