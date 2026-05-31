import { Page, PageContent } from '@/components/layout/page';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function AppliedLeadsLoadingPage() {
  return (
    <Page
      name="applied-leads-loading"
      title="Applied Leads"
      description="Leads that you have applied to."
    >
      <PageContent>
        <Card>
          <CardContent className="bg-accent/30 p-2 md:p-2">
            <TableSkeleton card={false} />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
