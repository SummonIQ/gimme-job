import { IndeedSearchForm } from '@/components/job-search/indeed-search-form';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { hasIndeedApiKey } from '@/lib/api/indeed-client';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { JobProvider } from '@/generated/prisma/browser';
import { AlertTriangle } from 'lucide-react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Search Indeed Jobs | Gimme Job',
  description: 'Search for jobs on Indeed and track your applications',
};

export default async function IndeedJobSearchPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Check if user has Indeed API key
  const hasApiKey = await hasIndeedApiKey();

  // Get user's job searches for presets
  const recentSearches = await db.jobSearch.findMany({
    where: {
      userId: user.id,
      jobProvider: JobProvider.INDEED,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  const recentSearchPresets = recentSearches.map(search => {
    const metadata = search.metadata as any;
    return {
      id: search.id,
      query: search.searchTerm,
      location: search.location || undefined,
      radius: metadata?.radius || undefined,
    };
  });

  return (
    <Page name="indeed-job-search" title="Search Indeed Jobs">
      <PageHeader
        title="Search Indeed Jobs"
        description="Find and apply to job listings from Indeed"
      />

      <PageContent>
        <div className="grid gap-6">
          {!hasApiKey && (
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You need to set up your Indeed API key in settings to get the
                most out of this feature.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent className="pt-6">
              <IndeedSearchForm
                hasApiKey={hasApiKey}
                recentSearches={recentSearchPresets}
              />
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground mt-4">
            <p>
              Search results will include jobs from Indeed that match your
              criteria.
              <br />
              You can track applications and set up alerts for new matching
              jobs.
            </p>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
