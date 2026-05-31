import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendNotification } from '@/lib/events/notifications';
import { getCurrentUser } from '@/lib/user/query';

export async function sendResumeNotification(
  id: string,
  {
    actionText,
    description,
    duration,
    title,
    type,
  }: {
    actionText: string;
    description: string;
    duration: number;
    title: string;
    type: 'success' | 'error' | 'info';
  },
) {
  const user = await getCurrentUser();
  const channel = getPrivateUserChannel(user.id);

  return sendNotification({
    channel,
    payload: {
      actionText,
      actionUrl: `/profile/resumes/${id}`,
      description,
      duration,
      title,
      type,
    },
  });
}
