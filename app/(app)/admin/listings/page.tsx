import { getAdminListingsPageData } from './data';
import { ListingsTabs } from './listings-tabs';

export default async function AdminListingsPage() {
  const { analytics, usageBudget, userId } = await getAdminListingsPageData();

  return (
    <ListingsTabs
      activeTab="analytics"
      analytics={analytics}
      usageBudget={usageBudget}
      userId={userId}
    />
  );
}
