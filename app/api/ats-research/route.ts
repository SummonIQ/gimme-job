import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type ATSSystem, type ATSAnalysisJob } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const startResearchSchema = z.object({
  searchQueries: z.array(z.string()).min(1),
  maxUrls: z.number().min(10).max(2000).default(1000),
});

// POST - Start ATS research job
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { searchQueries, maxUrls } = startResearchSchema.parse(body);

    // Create analysis job
    const job = await db.aTSAnalysisJob.create({
      data: {
        userId: user.id,
        status: 'pending',
        searchQueries,
        totalUrls: maxUrls,
      },
    });

    // Trigger background processing asynchronously
    fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ats-research/process`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      },
    ).catch(err => console.error('Error triggering background job:', err));

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Error starting ATS research:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to start research' },
      { status: 500 },
    );
  }
}

// GET - Get ATS systems and analysis jobs
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'both';

    let atsSystems: ATSSystem[] = [];
    let jobs: ATSAnalysisJob[] = [];

    if (type === 'systems' || type === 'both') {
      atsSystems = await db.aTSSystem.findMany({
        orderBy: [{ totalAnalyzed: 'desc' }, { name: 'asc' }],
      });
    }

    if (type === 'jobs' || type === 'both') {
      jobs = await db.aTSAnalysisJob.findMany({
        where: { userId: user.id },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });
    }

    return NextResponse.json({ atsSystems, jobs });
  } catch (error) {
    console.error('Error fetching ATS data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 },
    );
  }
}
