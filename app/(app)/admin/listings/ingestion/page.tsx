import { getAdminListingsPageData } from '../data';
import { ListingsTabs } from '../listings-tabs';

export default async function AdminListingsIngestionPage() {
  const { analytics, usageBudget, userId } = await getAdminListingsPageData();

  return (
    <ListingsTabs
      activeTab="ingestion"
      analytics={analytics}
      usageBudget={usageBudget}
      userId={userId}
    />
  );
}
