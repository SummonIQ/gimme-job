import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { PortfolioDashboard } from '@/components/portfolio/portfolio-dashboard';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Portfolio Management | gimme job',
  description:
    'Create, manage, and optimize your professional portfolios with AI-powered tools.',
};

export default function PortfolioPage() {
  return (
    <Page name="portfolio-management" title="Portfolio Management">
      <PageHeader
        title="Portfolio Management"
        description="Create stunning portfolios with AI-powered content generation, GitHub integration, and advanced analytics."
      />

      <PageContent>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-muted-foreground">
                  Loading portfolio dashboard...
                </p>
              </div>
            </div>
          }
        >
          <PortfolioDashboard />
        </Suspense>
      </PageContent>
    </Page>
  );
}
