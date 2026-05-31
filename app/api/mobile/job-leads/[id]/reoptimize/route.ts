import { reoptimizeJobLead } from '@/lib/job-leads/reoptimize';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await reoptimizeJobLead({ jobLeadId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reoptimize job lead:', error);
    return NextResponse.json(
      { error: 'Failed to reoptimize job lead' },
      { status: 500 },
    );
  }
}
