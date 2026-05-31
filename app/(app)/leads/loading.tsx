import { Page } from '@/components/layout/page';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';

export default function JobLeadsLoadingPage() {
  return (
    <Page
      name="job-leads-loading"
      title="Leads"
      description="View your job leads"
    >
      <TableSkeleton card={true} />
    </Page>
  );
}
