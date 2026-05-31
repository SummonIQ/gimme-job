import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { getCurrentUser } from '@/lib/user/query';
import { DataEventType } from '@/types/events';

export async function sendJobLeadAnalysisProgress({
  id,
  progress,
}: {
  id: string;
  progress: number;
}) {
  const user = await getCurrentUser();
  const userChannel = getPrivateUserChannel(user.id);

  const result = sendDataUpdate({
    channel: userChannel,
    payload: {
      data: {
        id,
        progress,
      },
      type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
    },
  });

  return result;
}
