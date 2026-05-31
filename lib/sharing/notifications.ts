import { ShareLink, ShareableResourceType } from './types';
import { User } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import { AppError, ErrorCode } from '@/lib/errors';

interface SendShareNotificationProps {
  recipientEmail: string;
  resourceType: ShareableResourceType;
  resourceId: string;
  shareLink: ShareLink;
  sender: User;
}

/**
 * Send a notification about a shared resource
 */
export async function sendShareNotification({
  recipientEmail,
  resourceType,
  resourceId,
  shareLink,
  sender
}: SendShareNotificationProps): Promise<void> {
  try {
    // Get resource info to include in the notification
    let resourceName: string = '';
    let resourceDescription: string = '';
    
    if (resourceType === ShareableResourceType.JOB_LEAD) {
      const jobLead = await db.jobLead.findUnique({
        where: { id: resourceId },
        include: { jobListing: true }
      });
      
      if (!jobLead) {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'Job lead not found'
        });
      }
      
      resourceName = jobLead.jobListing?.title || 'Job Lead';
      resourceDescription = jobLead.jobListing?.company || '';
    } else if (resourceType === ShareableResourceType.RESUME) {
      const resume = await db.resume.findUnique({
        where: { id: resourceId }
      });
      
      if (!resume) {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'Resume not found'
        });
      }
      
      resourceName = resume.name;
      resourceDescription = resume.description || '';
    }
    
    // Create notification record
    await db.notification.create({
      data: {
        type: `SHARE_${resourceType}`,
        title: `${sender.name} shared a ${resourceType === ShareableResourceType.JOB_LEAD ? 'job lead' : 'resume'} with you`,
        content: `${sender.name} has shared "${resourceName}" with you.${resourceDescription ? ` ${resourceDescription}` : ''}`,
        recipientEmail,
        metadata: {
          resourceType,
          resourceId,
          shareToken: shareLink.token,
          senderId: sender.id,
          senderName: sender.name,
          senderEmail: sender.email,
        },
        status: 'PENDING',
        userId: null // External user, not in our system
      }
    });
    
    // In a real-world scenario, you'd call your email service here
    console.log(`Notification sent to ${recipientEmail} about shared ${resourceType}`);
    
  } catch (error) {
    console.error('Error sending share notification:', error);
    throw error;
  }
}
