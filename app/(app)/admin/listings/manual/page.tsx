import { getAdminListingsPageData } from '../data';
import { ListingsTabs } from '../listings-tabs';

export default async function AdminListingsManualPage() {
  const { analytics, usageBudget, userId } = await getAdminListingsPageData();

  return (
    <ListingsTabs
      activeTab="manual"
      analytics={analytics}
      usageBudget={usageBudget}
      userId={userId}
    />
  );
}
