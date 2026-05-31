import { JobLeadStatus } from '@/generated/prisma/browser';
import { updateJobLeadStatus } from '@/lib/job-leads/status';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STATUSES = Object.values(JobLeadStatus);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const jobLead = await updateJobLeadStatus({
      jobLeadId: id,
      status: status as JobLeadStatus,
    });

    return NextResponse.json(jobLead);
  } catch (error) {
    console.error('Failed to update job lead status:', error);
    return NextResponse.json(
      { error: 'Failed to update job lead status' },
      { status: 500 },
    );
  }
}
