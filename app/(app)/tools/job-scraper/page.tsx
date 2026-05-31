import { ArrowDownToLine, Briefcase, ListFilter, Search } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSessionUser } from '@/lib/user/query';

export const metadata: Metadata = {
  description: 'Scrape and search for job listings across multiple platforms.',
  title: 'Job Scraper | Gimme Job',
};

interface ScraperEmptyStateProps {
  description: string;
  icon: React.ReactNode;
  title: string;
}

const ScraperEmptyState = ({
  description,
  icon,
  title,
}: ScraperEmptyStateProps) => (
  <div className="flex h-full grow flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-10">
    <div className="flex max-w-md flex-row items-start gap-3 rounded-lg border border-border bg-background p-6 shadow-sm">
      <div className="pt-0.5">{icon}</div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  </div>
);

export default async function JobScraperPage() {
  const user = await getSessionUser();

  if (!user || !user.id) {
    redirect('/login');
  }

  return (
    <Page name="job-scraper">
      <PageHeader
        title="Job Scraper"
        description="Scrape and search for job listings across multiple platforms."
      />
      <PageContent>
        <div className="grid grow grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Search</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="keywords">Keywords</Label>
                  <Input id="keywords" placeholder="e.g. React Developer" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="e.g. Remote, New York" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sources">Sources</Label>
                  <Select defaultValue="all">
                    <SelectTrigger id="sources">
                      <SelectValue placeholder="Select sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="indeed">Indeed</SelectItem>
                      <SelectItem value="glassdoor">Glassdoor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end pt-1">
                  <Button>
                    <Search className="size-4" />
                    Search Jobs
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Results</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <ListFilter className="size-4" />
                  Filter
                </Button>
                <Button size="sm" variant="outline">
                  <ArrowDownToLine className="size-4" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex grow flex-col">
              <Tabs
                className="flex grow flex-col gap-4"
                defaultValue="listings"
              >
                <TabsList className="w-fit">
                  <TabsTrigger value="listings">Job Listings</TabsTrigger>
                  <TabsTrigger value="saved">Saved Jobs</TabsTrigger>
                  <TabsTrigger value="history">Search History</TabsTrigger>
                </TabsList>

                <TabsContent className="grow" value="listings">
                  <ScraperEmptyState
                    icon={<Briefcase className="size-6 text-primary" />}
                    title="Job Listings"
                    description='Enter search criteria and click "Search Jobs" to find job listings across multiple platforms.'
                  />
                </TabsContent>

                <TabsContent className="grow" value="saved">
                  <ScraperEmptyState
                    icon={<Briefcase className="size-6 text-yellow-500" />}
                    title="Saved Jobs"
                    description="Your saved jobs will appear here."
                  />
                </TabsContent>

                <TabsContent className="grow" value="history">
                  <ScraperEmptyState
                    icon={<Search className="size-6 text-blue-500" />}
                    title="Search History"
                    description="Your previous job searches will be displayed here."
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
