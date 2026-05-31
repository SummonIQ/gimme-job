import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { CompanyResearchDashboard } from '@/components/linkedin/company-research-dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company Research Tools | Gimme Job',
  description:
    'Comprehensive LinkedIn company research with employee discovery, organizational charts, and networking intelligence',
};

export default function CompanyResearchPage() {
  return (
    <Page name="company-research">
      <PageHeader
        title="Company Research Tools"
        description="Research companies comprehensively with employee discovery, organizational insights, and strategic networking intelligence powered by LinkedIn data."
      />
      <PageContent>
        <CompanyResearchDashboard />
      </PageContent>
    </Page>
  );
}
