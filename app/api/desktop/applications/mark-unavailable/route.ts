import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { JobLeadStatus, JobListingStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';

const requestSchema = z
  .object({
    applicationUrl: z.string().optional(),
    detectedPhrase: z.string().optional(),
    jobLeadId: z.string().min(1).optional(),
    jobListingId: z.string().min(1).optional(),
    reason: z.enum([
      'http_404',
      'http_410',
      'closed_posting_copy',
      'closed_posting_marker',
      'embed_410',
      'embed_422',
      'unknown',
    ]),
  })
  .refine(body => body.jobLeadId || body.jobListingId, {
    message: 'jobLeadId or jobListingId is required',
  });

export async function POST(request: Request) {
  const rawToken = readBearerToken(request);
  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: 'Invalid request body',
      },
      { status: 400 },
    );
  }

  const userId = validation.token.userId;

  const lead = body.jobLeadId
    ? await db.jobLead.findUnique({
        select: { id: true, jobListingId: true, status: true, userId: true },
        where: { id: body.jobLeadId },
      })
    : null;
  if (body.jobLeadId && (!lead || lead.userId !== userId)) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const jobListingId = body.jobListingId ?? lead?.jobListingId ?? null;
  const listing = jobListingId
    ? await db.jobListing.findUnique({
        select: { id: true, status: true, userId: true },
        where: { id: jobListingId },
      })
    : null;
  if (jobListingId && (!listing || listing.userId !== userId)) {
    return NextResponse.json(
      { error: 'Job listing not found' },
      { status: 404 },
    );
  }

  const shouldUpdateLead = Boolean(
    lead && lead.status !== JobLeadStatus.UNAVAILABLE,
  );
  const shouldDismissListing = Boolean(
    listing && listing.status !== JobListingStatus.DISMISSED,
  );

  // Idempotent: if already unavailable/dismissed, no-op.
  if (!shouldUpdateLead && !shouldDismissListing) {
    return NextResponse.json({
      previousListingStatus: listing?.status ?? null,
      previousStatus: lead?.status ?? listing?.status ?? null,
      transitioned: false,
    });
  }

  await db.$transaction(async tx => {
    if (shouldUpdateLead && lead) {
      await tx.jobLead.update({
        data: { status: JobLeadStatus.UNAVAILABLE },
        where: { id: lead.id },
      });
    }
    if (shouldDismissListing && listing) {
      await tx.jobListing.update({
        data: { status: JobListingStatus.DISMISSED },
        where: { id: listing.id },
      });
    }
    await tx.automationAuditLog.create({
      data: {
        action: 'desktop_lead_marked_unavailable',
        actionType: 'success',
        metadata: {
          applicationUrl: body.applicationUrl ?? null,
          detectedPhrase: body.detectedPhrase ?? null,
          jobLeadId: lead?.id ?? null,
          jobListingId: listing?.id ?? null,
          previousListingStatus: listing?.status ?? null,
          previousStatus: lead?.status ?? null,
          reason: body.reason,
        },
        userId,
      },
    });
  });

  revalidateTag(`${userId}:job-leads`, 'max');
  if (lead) revalidateTag(`${userId}:job-leads:${lead.id}`, 'max');
  revalidateTag(`${userId}:report:job-leads`, 'max');
  if (lead) revalidateTag(`job-lead:${lead.id}`, 'max');
  revalidateTag(`user:${userId}:job-listings`, 'max');
  revalidateTag(`user:${userId}:job-listings:count`, 'max');
  if (listing)
    revalidateTag(`user:${userId}:job-listings:${listing.id}`, 'max');

  return NextResponse.json({
    previousListingStatus: listing?.status ?? null,
    previousStatus: lead?.status ?? listing?.status ?? null,
    transitioned: true,
  });
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}
