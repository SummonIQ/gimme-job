import { JobLeadStatus } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import { createJobLead } from '@/lib/job-leads/create';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'recent';

    const where: Record<string, unknown> = { userId: user.id };

    if (status) {
      const statuses = status.split(',') as JobLeadStatus[];
      where.status = { in: statuses };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        {
          jobListing: {
            company: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const orderBy =
      sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const };

    const [leads, total] = await Promise.all([
      db.jobLead.findMany({
        where,
        include: {
          jobFitAnalysis: {
            select: {
              overallMatchScore: true,
              summary: true,
              status: true,
            },
          },
          jobListing: {
            select: {
              company: true,
              companyLogoUrl: true,
              location: true,
              remote: true,
              salary: true,
              title: true,
              jobType: true,
            },
          },
          optimization: {
            select: {
              progress: true,
              status: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.jobLead.count({ where }),
    ]);

    return NextResponse.json({
      data: leads,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Failed to get job leads:', error);
    return NextResponse.json(
      { error: 'Failed to get job leads' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobListingId } = body;

    if (!jobListingId || typeof jobListingId !== 'string') {
      return NextResponse.json(
        { error: 'jobListingId is required' },
        { status: 400 },
      );
    }

    const jobLead = await createJobLead({ jobListingId });
    return NextResponse.json(jobLead, { status: 201 });
  } catch (error) {
    console.error('Failed to create job lead:', error);
    return NextResponse.json(
      { error: 'Failed to create job lead' },
      { status: 500 },
    );
  }
}
