import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { approved } = body;

    // Verify the application belongs to the user
    const application = await db.applicationSubmission.findFirst({
      where: {
        id,
        userId: session.user.id,
        status: 'PENDING',
        wasAutomated: true,
      },
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
      },
    });

    if (!application) {
      return new Response('Application not found', { status: 404 });
    }

    if (approved) {
      // Update application to proceed with submission
      await db.applicationSubmission.update({
        where: { id },
        data: {
          metadata: {
            ...((application.metadata as any) || {}),
            awaitingApproval: false,
            approvedAt: new Date().toISOString(),
            approvedBy: session.user.id,
          },
        },
      });

      // Log approval
      await db.automationAuditLog.create({
        data: {
          userId: session.user.id,
          action: 'application_approved',
          actionType: 'success',
          applicationSubmissionId: id,
          jobLeadId: application.jobLeadId,
          metadata: {
            jobTitle: application.jobLead.title,
            company: application.jobLead.jobListing.company,
          },
        },
      });

      // Here you would typically trigger the actual application submission
      // For now, we'll just mark it as ready to be processed

      return Response.json({
        success: true,
        message: 'Application approved and queued for submission',
      });
    } else {
      // Reject the application
      await db.applicationSubmission.update({
        where: { id },
        data: {
          status: 'REJECTED',
          errorMessage: 'Rejected by user during approval process',
          metadata: {
            ...((application.metadata as any) || {}),
            awaitingApproval: false,
            rejectedAt: new Date().toISOString(),
            rejectedBy: session.user.id,
          },
        },
      });

      // Log rejection
      await db.automationAuditLog.create({
        data: {
          userId: session.user.id,
          action: 'application_rejected',
          actionType: 'blocked',
          applicationSubmissionId: id,
          jobLeadId: application.jobLeadId,
          metadata: {
            jobTitle: application.jobLead.title,
            company: application.jobLead.jobListing.company,
            reason: 'User rejected during approval',
          },
        },
      });

      return Response.json({
        success: true,
        message: 'Application rejected',
      });
    }
  } catch (error) {
    console.error('Error processing approval:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
