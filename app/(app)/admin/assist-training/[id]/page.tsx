import { requireAdminUser } from '../../require-admin-user';
import { SessionDetailClient } from './_components/session-detail-client';
import { fetchAssistTrainingSessionDetail } from './_lib/fetch-session';

export default async function AssistTrainingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id } = await params;
  const data = await fetchAssistTrainingSessionDetail(id);

  return (
    <SessionDetailClient
      activeFlow={data.activeFlow}
      hostnameInsight={data.hostnameInsight}
      relatedSessions={data.relatedSessions}
      session={data.session}
      observations={data.observations}
      rules={data.rules}
      userId={data.userId}
    />
  );
}
