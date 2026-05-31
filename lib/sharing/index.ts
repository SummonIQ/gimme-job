import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { AppError, ErrorCode } from '@/lib/errors';
import { ShareableResourceType, ShareAccessLevel, ShareStatus, ShareLink, ShareOptions, ShareFeedback } from './types';
import { nanoid } from 'nanoid';
import { addDays } from 'date-fns';
import { sendShareNotification } from './notifications';

/**
 * Create a share link for a resource
 */
export async function createShareLink(
  resourceId: string, 
  resourceType: ShareableResourceType,
  options: ShareOptions
): Promise<ShareLink> {
  const user = await getCurrentUser();
  
  // Validate resource exists and belongs to user
  await validateResourceAccess(resourceId, resourceType, user.id);
  
  // Generate a unique token for the share link
  const token = nanoid(10);
  
  // Calculate expiration date if provided
  let expiresAt: Date | undefined = undefined;
  if (options.expirationDays) {
    expiresAt = addDays(new Date(), options.expirationDays);
  }
  
  // Create the share link
  const shareLink = await db.shareLink.create({
    data: {
      resourceId,
      resourceType,
      accessLevel: options.accessLevel,
      status: ShareStatus.ACTIVE,
      token,
      expiresAt,
      userId: user.id,
      recipientEmail: options.recipientEmail,
      accessCount: 0,
      allowFeedback: options.allowFeedback ?? false
    }
  });
  
  // Send email notification if recipient email was provided
  if (options.recipientEmail) {
    try {
      await sendShareNotification({
        recipientEmail: options.recipientEmail,
        resourceType,
        resourceId,
        shareLink,
        sender: user
      });
    } catch (error) {
      console.error('Failed to send share notification:', error);
      // Don't fail the entire operation if notification fails
    }
  }
  
  return shareLink;
}

/**
 * Get all share links for a specific resource
 */
export async function getShareLinksForResource(
  resourceId: string, 
  resourceType: ShareableResourceType
): Promise<ShareLink[]> {
  const user = await getCurrentUser();
  
  // Validate resource exists and belongs to user
  await validateResourceAccess(resourceId, resourceType, user.id);
  
  // Get all share links for this resource
  const shareLinks = await db.shareLink.findMany({
    where: {
      resourceId,
      resourceType,
      userId: user.id,
      status: {
        not: ShareStatus.REVOKED
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  return shareLinks;
}

/**
 * Get a resource by share token
 */
export async function getResourceByShareToken<T>(token: string): Promise<T> {
  // Find the share link by token
  const shareLink = await db.shareLink.findUnique({
    where: { token }
  });
  
  if (!shareLink) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Share link not found'
    });
  }
  
  // Check if the share link is active
  if (shareLink.status !== ShareStatus.ACTIVE) {
    throw new AppError({
      code: ErrorCode.FORBIDDEN,
      message: `Share link is ${shareLink.status.toLowerCase()}`
    });
  }
  
  // Check if the share link has expired
  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    // Update the status to expired
    await db.shareLink.update({
      where: { id: shareLink.id },
      data: { status: ShareStatus.EXPIRED }
    });
    
    throw new AppError({
      code: ErrorCode.FORBIDDEN,
      message: 'Share link has expired'
    });
  }
  
  // Update access count and last accessed time
  await db.shareLink.update({
    where: { id: shareLink.id },
    data: {
      accessCount: shareLink.accessCount + 1,
      lastAccessedAt: new Date()
    }
  });
  
  // Get the resource based on the resource type
  let resource: T | null = null;
  
  if (shareLink.resourceType === ShareableResourceType.JOB_LEAD) {
    resource = await db.jobLead.findUnique({
      where: { id: shareLink.resourceId },
      include: {
        jobListing: true,
        optimization: true
      }
    }) as unknown as T;
  } else if (shareLink.resourceType === ShareableResourceType.RESUME) {
    resource = await db.resume.findUnique({
      where: { id: shareLink.resourceId },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    }) as unknown as T;
  }
  
  if (!resource) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Shared resource not found'
    });
  }
  
  return resource;
}

/**
 * Revoke a share link
 */
export async function revokeShareLink(id: string): Promise<void> {
  const user = await getCurrentUser();
  
  const shareLink = await db.shareLink.findUnique({
    where: { id }
  });
  
  if (!shareLink) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Share link not found'
    });
  }
  
  if (shareLink.userId !== user.id) {
    throw new AppError({
      code: ErrorCode.FORBIDDEN,
      message: 'You do not have permission to revoke this share link'
    });
  }
  
  await db.shareLink.update({
    where: { id },
    data: { status: ShareStatus.REVOKED }
  });
}

/**
 * Add feedback to a shared resource
 */
export async function addShareFeedback(
  token: string,
  content: string,
  createdByName?: string,
  createdByEmail?: string
): Promise<ShareFeedback> {
  // Find the share link by token
  const shareLink = await db.shareLink.findUnique({
    where: { token }
  });
  
  if (!shareLink) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Share link not found'
    });
  }
  
  // Check if the share link is active
  if (shareLink.status !== ShareStatus.ACTIVE) {
    throw new AppError({
      code: ErrorCode.FORBIDDEN,
      message: `Share link is ${shareLink.status.toLowerCase()}`
    });
  }
  
  // Check if feedback is allowed
  if (!shareLink.allowFeedback) {
    throw new AppError({
      code: ErrorCode.FORBIDDEN,
      message: 'Feedback is not allowed for this shared resource'
    });
  }
  
  // Create the feedback
  const feedback = await db.shareFeedback.create({
    data: {
      shareLinkId: shareLink.id,
      content,
      createdByName,
      createdByEmail
    }
  });
  
  return feedback;
}

/**
 * Get feedback for a shared resource
 */
export async function getShareFeedback(resourceId: string, resourceType: ShareableResourceType): Promise<ShareFeedback[]> {
  const user = await getCurrentUser();
  
  // Validate resource exists and belongs to user
  await validateResourceAccess(resourceId, resourceType, user.id);
  
  // Find all share links for this resource
  const shareLinks = await db.shareLink.findMany({
    where: {
      resourceId,
      resourceType,
      userId: user.id
    },
    select: {
      id: true
    }
  });
  
  const shareLinkIds = shareLinks.map(link => link.id);
  
  // Get all feedback for these share links
  const feedback = await db.shareFeedback.findMany({
    where: {
      shareLinkId: {
        in: shareLinkIds
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  return feedback;
}

/**
 * Validate that a resource exists and belongs to the user
 */
async function validateResourceAccess(resourceId: string, resourceType: ShareableResourceType, userId: string): Promise<void> {
  let resource = null;
  
  if (resourceType === ShareableResourceType.JOB_LEAD) {
    resource = await db.jobLead.findUnique({
      where: {
        id: resourceId,
        userId
      }
    });
  } else if (resourceType === ShareableResourceType.RESUME) {
    resource = await db.resume.findUnique({
      where: {
        id: resourceId,
        userId
      }
    });
  }
  
  if (!resource) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `${resourceType === ShareableResourceType.JOB_LEAD ? 'Job lead' : 'Resume'} not found or you don't have access to it`
    });
  }
}
