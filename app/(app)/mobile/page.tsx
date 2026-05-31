import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { MobileViewTips } from '@/components/mobile/mobile-view-tips';
import { ResponsivenessAuditReport } from '@/components/mobile/responsive-audit-report';
import { getLatestResponsivenessAudit } from '@/lib/mobile/responsive-audit';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mobile Experience | Gimme Job',
  description: 'Mobile optimization and responsive design for Gimme Job',
};

export default async function MobileExperiencePage() {
  // Get the latest mobile responsiveness audit data
  const auditData = await getLatestResponsivenessAudit();

  return (
    <Page name="mobile-experience" title="Mobile Experience">
      <PageHeader
        title="Mobile Experience"
        description="Optimize your job search experience on mobile devices"
      />

      <PageContent>
        <div className="grid gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ResponsivenessAuditReport initialData={auditData || undefined} />
            </div>

            <div className="lg:col-span-1">
              <MobileViewTips />
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
