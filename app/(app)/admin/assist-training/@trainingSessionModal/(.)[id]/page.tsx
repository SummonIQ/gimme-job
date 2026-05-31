import { requireAdminUser } from '../../../require-admin-user';
import { SessionDetailClient } from '../../[id]/_components/session-detail-client';
import { fetchAssistTrainingSessionDetail } from '../../[id]/_lib/fetch-session';
import { SessionModalShell } from './_components/session-modal-shell';

export default async function InterceptedSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id } = await params;
  const data = await fetchAssistTrainingSessionDetail(id);

  return (
    <SessionModalShell>
      <SessionDetailClient
        activeFlow={data.activeFlow}
        hostnameInsight={data.hostnameInsight}
        relatedSessions={data.relatedSessions}
        session={data.session}
        observations={data.observations}
        rules={data.rules}
        userId={data.userId}
      />
    </SessionModalShell>
  );
}
