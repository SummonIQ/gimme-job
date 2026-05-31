import type {
  NotificationEventType,
  ApplicationStatusNotificationMetadata,
  InterviewRequestNotificationMetadata
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3020';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Render email template for a notification
 */
export async function renderEmailTemplate(
  eventType: NotificationEventType,
  metadata: any,
  recipientName?: string
): Promise<EmailTemplate> {
  // Dynamic imports to avoid bundling react-dom/server in client
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ApplicationStatusEmail } = await import('./templates/application-status');
  const { InterviewRequestEmail } = await import('./templates/interview-request');

  let subject: string;
  let html: string;
  let text: string;

  switch (eventType) {
    case 'APPLICATION_STATUS_CHANGED': {
      const meta = metadata as ApplicationStatusNotificationMetadata;
      subject = `Application Update: ${meta.jobTitle} at ${meta.companyName}`;
      html = renderToStaticMarkup(
        ApplicationStatusEmail({ metadata: meta, recipientName, baseUrl: BASE_URL })
      );
      text = `Your application for ${meta.jobTitle} at ${meta.companyName} has been updated from ${meta.previousStatus} to ${meta.newStatus}. View details: ${BASE_URL}/leads/${meta.jobLeadId}`;
      break;
    }

    case 'INTERVIEW_REQUESTED': {
      const meta = metadata as InterviewRequestNotificationMetadata;
      subject = `Interview Request: ${meta.jobTitle} at ${meta.companyName}`;
      html = renderToStaticMarkup(
        InterviewRequestEmail({ metadata: meta, recipientName, baseUrl: BASE_URL })
      );
      text = `You've received an interview request for ${meta.jobTitle} at ${meta.companyName}${meta.interviewDate ? ` scheduled for ${meta.interviewDate}` : ''}. View details: ${BASE_URL}/leads/${meta.jobLeadId}`;
      break;
    }

    case 'JOB_SEARCH_COMPLETED': {
      subject = `Job Search Complete: ${metadata.searchQuery}`;
      html = `<p>Your job search for "${metadata.searchQuery}" has completed. Found ${metadata.jobsFound} jobs, ${metadata.newJobsAdded} new jobs added to your leads.</p><p><a href="${BASE_URL}/jobs/searches/${metadata.searchId}">View Results</a></p>`;
      text = `Your job search for "${metadata.searchQuery}" has completed. Found ${metadata.jobsFound} jobs, ${metadata.newJobsAdded} new jobs added to your leads. View: ${BASE_URL}/jobs/searches/${metadata.searchId}`;
      break;
    }

    case 'RESUME_ANALYSIS_COMPLETED': {
      subject = `Resume Analysis Complete: ${metadata.resumeName}`;
      html = `<p>Your resume analysis for "${metadata.resumeName}" is complete${metadata.score ? ` with a score of ${metadata.score}%` : ''}. ${metadata.suggestions} suggestions available.</p><p><a href="${BASE_URL}/profile/resumes">View Analysis</a></p>`;
      text = `Your resume analysis for "${metadata.resumeName}" is complete${metadata.score ? ` with a score of ${metadata.score}%` : ''}. ${metadata.suggestions} suggestions available. View: ${BASE_URL}/profile/resumes`;
      break;
    }

    case 'AUTOMATION_EVENT': {
      const automationName = metadata.automationType === 'application_submission' ? 'Application Submissions' :
                             metadata.automationType === 'job_search' ? 'Job Search' : 'Resume Analysis';
      subject = `${automationName} ${metadata.status === 'completed' ? 'Complete' : metadata.status === 'failed' ? 'Failed' : 'Update'}`;
      html = `<p>${automationName} automation has ${metadata.status}. Processed ${metadata.itemsProcessed} of ${metadata.totalItems} items.</p><p><a href="${BASE_URL}/tools/automation">View Details</a></p>`;
      text = `${automationName} automation has ${metadata.status}. Processed ${metadata.itemsProcessed} of ${metadata.totalItems} items. View: ${BASE_URL}/tools/automation`;
      break;
    }

    default:
      subject = 'Notification from Gimme Job';
      html = `<p>You have a new notification.</p><p><a href="${BASE_URL}/notifications">View Notifications</a></p>`;
      text = `You have a new notification. View: ${BASE_URL}/notifications`;
  }

  return { subject, html, text };
}

/**
 * Send email via configured email provider
 * In production, this would integrate with services like SendGrid, AWS SES, Resend, etc.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // For now, just log the email
    // In production, replace with actual email service:
    //
    // Example with Resend:
    // const { data, error } = await resend.emails.send({
    //   from: 'Gimme Job <notifications@gimmejob.com>',
    //   to: params.to,
    //   subject: params.subject,
    //   html: params.html,
    //   text: params.text
    // });
    //
    // if (error) {
    //   throw error;
    // }
    //
    // return { success: true, messageId: data.id };

    console.log('[EMAIL SERVICE] Would send email:', {
      to: params.to,
      subject: params.subject,
      htmlLength: params.html.length,
      textLength: params.text.length
    });

    // Simulate successful send
    return {
      success: true,
      messageId: `mock-${Date.now()}`
    };
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send batch digest email with multiple notifications
 */
export async function sendDigestEmail(params: {
  to: string;
  recipientName?: string;
  notifications: Array<{
    eventType: NotificationEventType;
    title: string;
    body: string;
    metadata: any;
    createdAt: Date;
  }>;
  digestType: 'daily' | 'weekly';
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, recipientName, notifications, digestType } = params;

  const subject = `Your ${digestType} digest - ${notifications.length} update${notifications.length === 1 ? '' : 's'}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${digestType === 'daily' ? 'Daily' : 'Weekly'} Digest</h2>
      <p>Hi ${recipientName || 'there'},</p>
      <p>Here's your summary of ${notifications.length} notification${notifications.length === 1 ? '' : 's'}:</p>
      <div style="margin: 20px 0;">
        ${notifications.map(n => `
          <div style="margin-bottom: 20px; padding: 15px; background: #f7fafc; border-radius: 6px;">
            <h3 style="margin: 0 0 8px;">${n.title}</h3>
            <p style="margin: 0 0 8px; color: #4a5568;">${n.body}</p>
            <p style="margin: 0; font-size: 12px; color: #718096;">${n.createdAt.toLocaleString()}</p>
          </div>
        `).join('')}
      </div>
      <p><a href="${BASE_URL}/notifications" style="color: #3b82f6;">View all notifications</a></p>
    </div>
  `;

  const text = `
${digestType === 'daily' ? 'Daily' : 'Weekly'} Digest

Hi ${recipientName || 'there'},

Here's your summary of ${notifications.length} notification${notifications.length === 1 ? '' : 's'}:

${notifications.map((n, i) => `
${i + 1}. ${n.title}
   ${n.body}
   ${n.createdAt.toLocaleString()}
`).join('\n')}

View all: ${BASE_URL}/notifications
  `.trim();

  return sendEmail({ to, subject, html, text });
}
