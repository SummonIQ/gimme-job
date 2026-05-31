import { unauthorized } from 'next/navigation';

import { useSession } from '@/lib/auth/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { sendNotification } from '@/lib/events/notifications';
import { type DataEventPayload, DataEventType } from '@/types/events';

function getEventPayload(eventType: DataEventType, i: number) {
  const resumeId = 'cm6dwzu3x00029kl408k1uj3h';
  const jobScraperId = 'cm6df1pgh00009klbw8yz4o9g';
  const jobLeadId = 'cm6df1pgh00009klbw8yz4o9g';

  switch (eventType) {
    case DataEventType.RESUME_ANALYSIS_PROGRESS:
      return {
        data: {
          id: resumeId,
          progress: i * 10,
        },
        type: DataEventType.RESUME_ANALYSIS_PROGRESS,
      };
    case DataEventType.JOB_LEAD_ANALYSIS_PROGRESS:
      return {
        data: {
          id: jobLeadId,
          progress: i * 10,
        },
        type: DataEventType.JOB_LEAD_ANALYSIS_PROGRESS,
      };
    case DataEventType.JOB_SEARCH_PROGRESS:
      return {
        data: {
          id: jobScraperId,
          jobListingsCount: 10 * i,
          page: i,
          progress: i * 10,
          totalPages: 10,
        },
        type: DataEventType.JOB_SEARCH_PROGRESS,
      };
    default:
      return null;
  }
}

export async function triggerPush() {
  const { data: session } = await useSession();

  if (!session || !session.user) {
    unauthorized();
  }

  const userId = session.user.id as string;
  const userChannel = getPrivateUserChannel(userId);

  const testEventType = DataEventType.RESUME_ANALYSIS_PROGRESS;

  for (let i = 0; i <= 10; i++) {
    const eventPayload = getEventPayload(testEventType, i);

    sendDataUpdate({
      channel: userChannel,
      payload: eventPayload as DataEventPayload,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // @ts-expect-error - This is just for testing
  if (testEventType === DataEventType.JOB_SEARCH_PROGRESS) {
    sendNotification({
      channel: userChannel,
      payload: {
        actionText: 'View results',
        actionUrl: '/tools/job-scraper/cm6df1pgh00009klbw8yz4o9g',
        description: `Job scraper complete for search 'test'`,
        duration: 5000,
        title: 'Job scraper complete',
        type: 'success',
      },
    });
  } else if (testEventType === DataEventType.RESUME_ANALYSIS_PROGRESS) {
    sendNotification({
      channel: userChannel,
      payload: {
        actionText: 'View results',
        actionUrl: '/profile/resumes/cm6dwzu3x00029kl408k1uj3h',
        description: 'Resume analysis complete',
        duration: 5000,
        title: 'Resume analysis complete',
        type: 'success',
      },
    });
  }
}
