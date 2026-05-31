import { type NextRequest, NextResponse } from 'next/server';

import { JobProvider } from '@/generated/prisma/browser';
import { isAdminUser } from '@/lib/admin/scrape-service';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const GREENHOUSE_JOB_ID_QUERY_MATCH = 'gh_jid';
const GREENHOUSE_SOURCE_MATCH = 'greenhouse';
const GREENHOUSE_URL_MATCH = 'greenhouse.io';

/**
 * GET /api/assist-training/random-job
 * Returns a random job listing from the DB that has an apply URL,
 * suitable for training. Instant — no external API calls.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminUser(user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const provider = request.nextUrl.searchParams
      .get('provider')
      ?.trim()
      .toLowerCase();
    const baseWhere = {
      jobProviderUrl: { not: null as string | null },
    };
    const greenhouseWhere = {
      ...baseWhere,
      OR: [
        { jobProvider: JobProvider.GREENHOUSE },
        {
          source: {
            contains: GREENHOUSE_SOURCE_MATCH,
            mode: 'insensitive' as const,
          },
        },
        {
          jobProviderUrl: {
            contains: GREENHOUSE_URL_MATCH,
            mode: 'insensitive' as const,
          },
        },
        {
          jobProviderUrl: {
            contains: GREENHOUSE_JOB_ID_QUERY_MATCH,
            mode: 'insensitive' as const,
          },
        },
      ],
    };
    const where = provider === 'greenhouse' ? greenhouseWhere : baseWhere;

    const count = await db.jobListing.count({ where });

    if (count === 0) {
      return NextResponse.json(
        {
          error:
            provider === 'greenhouse'
              ? 'No Greenhouse job listings with apply URLs found'
              : 'No job listings with apply URLs found',
        },
        { status: 404 },
      );
    }

    const randomOffset = Math.floor(Math.random() * count);

    const listing = await db.jobListing.findFirst({
      skip: randomOffset,
      where,
      select: {
        company: true,
        id: true,
        jobProvider: true,
        jobProviderUrl: true,
        source: true,
        title: true,
      },
    });

    if (!listing || !listing.jobProviderUrl) {
      return NextResponse.json(
        { error: 'No suitable job found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      company: listing.company,
      id: listing.id,
      jobProvider: listing.jobProvider,
      source: listing.source,
      title: listing.title,
      url: listing.jobProviderUrl,
    });
  } catch (error) {
    console.error('[random-job]', error);
    return NextResponse.json(
      { error: 'Failed to fetch random job' },
      { status: 500 },
    );
  }
}
