import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Get user's automation settings
    const settings = await db.automationSettings.findUnique({
      where: { userId: session.user.id },
    });

    // If user approval is not required, return empty array
    if (!settings?.requireUserApproval) {
      return Response.json([]);
    }

    // Get pending applications awaiting approval
    const pendingApplications = await db.applicationSubmission.findMany({
      where: {
        userId: session.user.id,
        status: 'PENDING',
        wasAutomated: true,
        metadata: {
          path: ['awaitingApproval'],
          equals: true,
        },
      },
      include: {
        jobLead: {
          select: {
            title: true,
            jobListing: {
              select: {
                company: true,
                location: true,
                salary: true,
                description: true,
                jobProviderUrl: true,
              },
            },
          },
        },
        resume: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const formattedApplications = pendingApplications.map(app => ({
      id: app.id,
      jobLeadId: app.jobLeadId,
      jobTitle: app.jobLead.title,
      companyName: app.jobLead.jobListing.company,
      location: app.jobLead.jobListing.location,
      salary: app.jobLead.jobListing.salary,
      url: app.jobLead.jobListing.jobProviderUrl,
      description: app.jobLead.jobListing.description,
      createdAt: app.createdAt,
      resumeId: app.resumeId,
      resumeName: app.resume?.name,
    }));

    return Response.json(formattedApplications);
  } catch (error) {
    console.error('Error fetching pending applications:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
