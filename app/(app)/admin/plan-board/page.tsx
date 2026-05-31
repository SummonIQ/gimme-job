import { Responsive } from '@/components/layout/responsive';
import { getPlanBoardSnapshot } from '@/lib/admin/plan-board';
import { getPlanBoardRealtimeConfig } from '@/lib/admin/summonflow';

import { requireAdminUser } from '../require-admin-user';
import { PlanBoardClient } from './plan-board-client';

export default async function AdminPlanBoardPage() {
  await requireAdminUser();

  const [snapshot, realtimeConfig] = await Promise.all([
    getPlanBoardSnapshot(),
    Promise.resolve(getPlanBoardRealtimeConfig()),
  ]);

  return (
    <Responsive
      center
      className="flex grow flex-col px-3 pt-4 pb-4 md:px-6 max-w-screen-2xl"
    >
      <PlanBoardClient
        initialHealthReport={snapshot.healthReport}
        initialSyncReport={snapshot.syncReport}
        initialTasks={snapshot.tasks}
        realtimeConfig={realtimeConfig}
      />
    </Responsive>
  );
}
