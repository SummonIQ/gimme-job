import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  createShareLink,
  getShareFeedback,
  getShareLinksForResource,
  revokeShareLink,
} from '@/lib/sharing';
import { ShareableResourceType, ShareAccessLevel } from '@/lib/sharing/types';
import { getCurrentUser } from '@/lib/user';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createShareLinkSchema = z.object({
  resourceId: z.string(),
  resourceType: z.nativeEnum(ShareableResourceType),
  accessLevel: z.nativeEnum(ShareAccessLevel),
  expirationDays: z.number().optional(),
  recipientEmail: z.string().email().optional(),
  allowFeedback: z.boolean().optional(),
});

const getShareLinksSchema = z.object({
  resourceId: z.string(),
  resourceType: z.nativeEnum(ShareableResourceType),
});

const revokeShareLinkSchema = z.object({
  id: z.string(),
});

/**
 * POST handler for creating a new share link
 */
const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  const validation = createShareLinkSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid request data',
        errors: validation.error.format(),
      },
      { status: 400 },
    );
  }

  const shareLink = await createShareLink(body.resourceId, body.resourceType, {
    accessLevel: body.accessLevel,
    expirationDays: body.expirationDays,
    recipientEmail: body.recipientEmail,
    allowFeedback: body.allowFeedback,
  });

  return NextResponse.json({
    success: true,
    data: shareLink,
  });
};

/**
 * GET handler for retrieving share links or feedback
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const resourceId = url.searchParams.get('resourceId');
  const resourceType = url.searchParams.get(
    'resourceType',
  ) as ShareableResourceType;
  const feedbackOnly = url.searchParams.get('feedbackOnly') === 'true';

  if (!resourceId || !resourceType) {
    return NextResponse.json(
      {
        success: false,
        message: 'resourceId and resourceType are required query parameters',
      },
      { status: 400 },
    );
  }

  if (!Object.values(ShareableResourceType).includes(resourceType)) {
    return NextResponse.json(
      { success: false, message: 'Invalid resourceType' },
      { status: 400 },
    );
  }

  if (feedbackOnly) {
    const feedback = await getShareFeedback(resourceId, resourceType);
    return NextResponse.json({
      success: true,
      data: feedback,
    });
  } else {
    const shareLinks = await getShareLinksForResource(resourceId, resourceType);
    return NextResponse.json({
      success: true,
      data: shareLinks,
    });
  }
};

/**
 * DELETE handler for revoking a share link
 */
const handleDELETE = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  const validation = revokeShareLinkSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid request data',
        errors: validation.error.format(),
      },
      { status: 400 },
    );
  }

  await revokeShareLink(body.id);

  return NextResponse.json({
    success: true,
    message: 'Share link revoked successfully',
  });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
export const DELETE = withApiErrorHandling(handleDELETE);
