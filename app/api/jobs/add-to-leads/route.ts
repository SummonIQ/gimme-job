import { NextRequest, NextResponse } from 'next/server';

import { addLiveJobToLeads } from '@/lib/job-listings/live';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await addLiveJobToLeads(body);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to add to leads';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
