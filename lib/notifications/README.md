# Enhanced Notifications System

A comprehensive notification system with multi-channel delivery, email templates, smart batching, and digest support.

## Features

- **Multi-Channel Delivery**: In-app, email, push, and SMS notifications
- **Email Templates**: Beautiful, responsive HTML email templates
- **Smart Batching**: Automatic batching based on quiet hours, rate limits, and user preferences
- **Digest Delivery**: Daily and weekly digest emails
- **User Preferences**: Granular control over notification types and channels
- **Real-time**: Pusher integration for instant in-app notifications

## Architecture

### Core Components

- **`index.ts`**: Main notification creation and delivery logic
- **`types.ts`**: TypeScript types and interfaces
- **`email-service.ts`**: Email rendering and sending service
- **`batching.ts`**: Notification batching and digest processing
- **`templates/`**: React-based email templates

### Email Templates

Located in `templates/`:
- **`base.tsx`**: Reusable layout components (EmailLayout, EmailHeader, EmailContent, etc.)
- **`application-status.tsx`**: Application status update emails
- **`interview-request.tsx`**: Interview request emails

## Usage

### Creating Notifications

```typescript
import { createApplicationStatusNotification } from '@/lib/notifications';

await createApplicationStatusNotification(userId, {
  jobLeadId: 'job-123',
  jobTitle: 'Senior Software Engineer',
  companyName: 'Acme Corp',
  previousStatus: 'Applied',
  newStatus: 'Interview',
  applicationId: 'app-456'
});
```

### Notification Types

- `APPLICATION_STATUS_CHANGED` - Application status updates (urgent)
- `INTERVIEW_REQUESTED` - Interview requests (urgent)
- `JOB_SEARCH_COMPLETED` - Job search results
- `RESUME_ANALYSIS_COMPLETED` - Resume analysis results
- `AUTOMATION_EVENT` - Automation progress/completion
- `NETWORKING_REMINDER` - Networking reminders
- `SHARE_ACTIVITY` - Share activity notifications
- `RESUME_FEEDBACK_PROVIDED` - Resume feedback notifications
- `SYSTEM_ALERT` - System alerts

### User Preferences

Users can control:
- Which event types they want to receive
- Which channels (in-app, email, push) to use
- Digest frequency (none, daily, weekly)

```typescript
import { getUserNotificationPreferences, updateNotificationPreferences } from '@/lib/notifications';

// Get preferences
const preferences = await getUserNotificationPreferences(userId);

// Update preferences
await updateNotificationPreferences(userId, {
  emailEnabled: true,
  inAppEnabled: true,
  applicationStatusEnabled: true,
  interviewRequestsEnabled: true
});
```

## Email Service Integration

### Supported Providers

The email service supports multiple providers:
- **SendGrid** (recommended)
- **AWS SES**
- **Resend**

### Configuration

Add environment variables for your chosen provider:

**SendGrid:**
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="Gimme Job"
```

**AWS SES:**
```bash
EMAIL_PROVIDER=aws-ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="Gimme Job"
```

**Resend:**
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="Gimme Job"
```

### Email Service Setup

Update `lib/notifications/email-service.ts` to uncomment your provider:

```typescript
// Example: SendGrid integration
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    await sgMail.send({
      to: options.to,
      from: {
        email: process.env.EMAIL_FROM!,
        name: process.env.EMAIL_FROM_NAME || 'Gimme Job'
      },
      subject: options.subject,
      html: options.html,
      text: options.text
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## Batching & Digests

### Smart Batching Rules

Notifications are automatically batched based on:
- **Urgency**: Urgent notifications (interviews, status changes) are sent immediately
- **Quiet Hours**: 10 PM - 8 AM (configurable)
- **Rate Limits**: Max 5 per hour, 20 per day (configurable)
- **User Preferences**: Daily or weekly digest settings

### Digest Processing

Digests are processed via scheduled cron jobs:

**Daily Digest**: Runs at 9 AM daily
```bash
curl -X POST https://yourdomain.com/api/notifications/digests/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Weekly Digest**: Runs at 9 AM on Mondays
```bash
curl -X POST https://yourdomain.com/api/notifications/digests/weekly \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Vercel Cron Configuration

The `vercel.json` file configures automatic cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/notifications/digests/daily",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/notifications/digests/weekly",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### Cron Secret Setup

Add a `CRON_SECRET` environment variable to protect your cron endpoints:

```bash
CRON_SECRET=your_secure_random_string
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Database Schema

The notification system uses these Prisma models:

- **`Notification`**: Core notification data
- **`NotificationPreference`**: User notification preferences
- **`NotificationDelivery`**: Multi-channel delivery tracking

## Testing

### Manual Testing in Development

Test digest processing locally:

```bash
# Daily digest
curl http://localhost:3020/api/notifications/digests/daily

# Weekly digest
curl http://localhost:3020/api/notifications/digests/weekly
```

### Creating Test Notifications

```typescript
import { createNotification } from '@/lib/notifications';
import { NotificationStatus, NotificationPriority, NotificationCategory, NotificationChannel } from '@/lib/notifications/types';

await createNotification({
  userId: 'user-123',
  recipientEmail: 'user@example.com',
  type: 'APPLICATION_STATUS_CHANGED',
  title: 'Test Notification',
  body: 'This is a test notification',
  status: NotificationStatus.PENDING,
  priority: NotificationPriority.HIGH,
  category: NotificationCategory.APPLICATION_STATUS,
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
});
```

## Adding New Email Templates

1. Create a new template in `templates/`:

```typescript
// templates/my-new-template.tsx
import { EmailLayout, EmailHeader, EmailContent, EmailButton, EmailFooter } from './base';

export interface MyTemplateProps {
  recipientName?: string;
  // ... other props
}

export function MyEmailTemplate({ recipientName, ...props }: MyTemplateProps) {
  return (
    <EmailLayout preheader="Your custom preheader">
      <EmailHeader />
      <EmailContent>
        <h1>Hello {recipientName || 'there'}!</h1>
        {/* Template content */}
      </EmailContent>
      <EmailFooter />
    </EmailLayout>
  );
}
```

2. Add the template to `email-service.ts`:

```typescript
case 'MY_NEW_EVENT_TYPE':
  const myTemplate = renderToStaticMarkup(
    <MyEmailTemplate
      recipientName={recipientName}
      // ... pass props from metadata
    />
  );
  return {
    subject: 'Your Subject Line',
    html: myTemplate,
    text: 'Plain text version'
  };
```

3. Add the event type to `types.ts`:

```typescript
export type NotificationEventType =
  | 'MY_NEW_EVENT_TYPE'
  | ... existing types
```

## Monitoring & Debugging

### Logging

All notification operations are logged with prefixes:
- `[EMAIL]` - Email sending operations
- `[BATCH]` - Batching operations
- `[CRON]` - Cron job operations

### Database Queries

Check notification delivery status:

```typescript
// Get all pending notifications
const pending = await db.notification.findMany({
  where: { status: NotificationStatus.PENDING }
});

// Get failed deliveries
const failed = await db.notificationDelivery.findMany({
  where: { status: NotificationStatus.FAILED }
});
```

## Best Practices

1. **Always respect user preferences**: Check if user has enabled the notification type and channel
2. **Use appropriate urgency**: Only mark truly urgent notifications (interviews, critical updates) as urgent
3. **Provide meaningful actions**: Include actionUrl and actionLabel for actionable notifications
4. **Test email templates**: Always test in multiple email clients (Gmail, Outlook, etc.)
5. **Monitor delivery rates**: Track failed deliveries and investigate patterns
6. **Rate limit external APIs**: Be mindful of email provider rate limits

## Troubleshooting

### Emails not sending

1. Check email provider configuration
2. Verify environment variables are set
3. Check delivery status in database
4. Review email service logs

### Digests not processing

1. Verify cron jobs are configured correctly
2. Check `CRON_SECRET` environment variable
3. Review cron job logs in Vercel dashboard
4. Test endpoints manually in development

### Batching not working

1. Check user notification preferences (digest setting)
2. Verify batching rules in `batching.ts`
3. Check notification timestamps and quiet hours
4. Review batching logs

## Future Enhancements

- [ ] Push notification support (web push, mobile)
- [ ] SMS notification support
- [ ] More email templates (job search, resume analysis, etc.)
- [ ] A/B testing for notification delivery times
- [ ] Analytics dashboard for notification engagement
- [ ] Unsubscribe management
- [ ] Notification grouping and threading
