import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { NetworkAnalysisDashboard } from '@/components/linkedin/network-analysis-dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Network Analysis & Visualization | Gimme Job',
  description:
    'Visualize and analyze your LinkedIn professional network to identify gaps and opportunities',
};

export default function NetworkAnalysisPage() {
  return (
    <Page name="network-analysis">
      <PageHeader
        title="Network Analysis & Visualization"
        description="Visualize your professional network, identify gaps, and discover optimal connection paths to reach your career goals."
      />
      <PageContent>
        <NetworkAnalysisDashboard />
      </PageContent>
    </Page>
  );
}
