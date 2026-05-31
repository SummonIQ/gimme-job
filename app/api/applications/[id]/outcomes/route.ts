import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { ApplicationStatus } from '@/generated/prisma/browser';
import { z } from 'zod';

const outcomeEventSchema = z.object({
  eventType: z.string(),
  newStatus: z.nativeEnum(ApplicationStatus),
  previousStatus: z.nativeEnum(ApplicationStatus).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const application = await db.applicationSubmission.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        outcomeEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(application.outcomeEvents);
  } catch (error) {
    console.error('Error fetching outcome events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = outcomeEventSchema.parse(body);

    // Verify the application belongs to the user
    const application = await db.applicationSubmission.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 },
      );
    }

    // Calculate timing metrics
    const now = new Date();
    const submissionDate = application.submittedAt || application.createdAt;
    const daysSinceSubmission = Math.floor(
      (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let updateData: any = {
      status: validatedData.newStatus,
      lastStatusChangeAt: now,
      daysSinceSubmission,
    };

    // Track first response
    if (
      !application.responseReceivedAt &&
      validatedData.eventType === 'response_received'
    ) {
      const daysToResponse = Math.floor(
        (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      updateData.responseReceivedAt = now;
      updateData.daysToResponse = daysToResponse;
    }

    // Track final outcomes
    const isFinalStatus =
      validatedData.newStatus === ApplicationStatus.OFFER_ACCEPTED ||
      validatedData.newStatus === ApplicationStatus.OFFER_REJECTED ||
      validatedData.newStatus === ApplicationStatus.REJECTED ||
      validatedData.newStatus === ApplicationStatus.NOT_SELECTED ||
      validatedData.newStatus === ApplicationStatus.WITHDRAWN;

    if (isFinalStatus && !application.finalOutcomeAt) {
      const daysToFinalOutcome = Math.floor(
        (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      updateData.finalOutcomeAt = now;
      updateData.daysToFinalOutcome = daysToFinalOutcome;
    }

    // Track interview count
    if (
      validatedData.eventType === 'interview_scheduled' ||
      validatedData.newStatus === ApplicationStatus.INTERVIEW_SCHEDULED ||
      validatedData.newStatus === ApplicationStatus.INTERVIEW_COMPLETED
    ) {
      updateData.interviewCount = application.interviewCount + 1;
    }

    // Create the outcome event and update application in a transaction
    const result = await db.$transaction(async tx => {
      const outcomeEvent = await tx.applicationOutcomeEvent.create({
        data: {
          applicationSubmissionId: id,
          eventType: validatedData.eventType,
          newStatus: validatedData.newStatus,
          previousStatus: validatedData.previousStatus || application.status,
          metadata: validatedData.metadata,
          notes: validatedData.notes,
          createdBy: session.user.id,
        },
      });

      const updatedApplication = await tx.applicationSubmission.update({
        where: { id },
        data: updateData,
      });

      return { outcomeEvent, updatedApplication };
    });

    return NextResponse.json(result.outcomeEvent, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error creating outcome event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
