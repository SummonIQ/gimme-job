'use client';

import {
  JobProviderPerformanceChart,
  ResponseRatesChart,
  ResumePerformanceChart,
  StatCard,
  StatusDistributionChart,
} from '@/components/analytics/charts';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AnalyticsData } from '@/lib/analytics';
import { formatPercentage } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface AnalyticsDashboardProps {
  initialData: AnalyticsData;
}

export default function AnalyticsDashboard({
  initialData,
}: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] =
    useState<AnalyticsData>(initialData);
  const [period, setPeriod] = useState('90'); // Default to 90 days

  useEffect(() => {
    if (period === '90') {
      setLoading(false);
      setAnalyticsData(initialData);
      return;
    }

    async function fetchAnalytics() {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/applications?period=${period}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { data: AnalyticsData };
        setAnalyticsData(payload.data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [initialData, period]);

  // Format data for status distribution chart
  const statusDistributionData = [
    { name: 'Submitted', value: analyticsData.overview.submitted },
    { name: 'Rejected', value: analyticsData.overview.rejected },
    { name: 'Interviewing', value: analyticsData.overview.interviewing },
    { name: 'Offered', value: analyticsData.overview.offered },
    { name: 'Accepted', value: analyticsData.overview.accepted },
    { name: 'Archived', value: analyticsData.overview.archived },
  ];

  // Format data for response rates chart
  const responseRatesData = [
    { name: 'Responses', value: analyticsData.responseRates.responseRate },
    {
      name: 'Interviews',
      value: analyticsData.responseRates.interviewRate,
    },
    { name: 'Offers', value: analyticsData.responseRates.offerRate },
  ];

  return (
    <Page name="dashboard-analytics" title="Analytics Dashboard">
      <PageHeader
        title="Analytics Dashboard"
        description="Track your job search performance and application metrics."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Time period:</span>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
                <SelectItem value="365">Last 365 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      <PageContent>
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="job-boards">Job Boards</TabsTrigger>
            <TabsTrigger value="resumes">Resumes</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {loading ? (
                Array(4)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i} className="p-6">
                      <Skeleton className="h-8 w-28 mb-2" />
                      <Skeleton className="h-14 w-full" />
                    </Card>
                  ))
              ) : (
                <>
                  <StatCard
                    title="Total Applications"
                    value={analyticsData?.overview.total || 0}
                  />
                  <StatCard
                    title="Response Rate"
                    value={`${analyticsData ? formatPercentage(analyticsData.responseRates.responseRate / 100) : '0%'}`}
                    description="Applications that received a response"
                  />
                  <StatCard
                    title="Interview Rate"
                    value={`${analyticsData ? formatPercentage(analyticsData.responseRates.interviewRate / 100) : '0%'}`}
                    description="Applications that led to interviews"
                  />
                  <StatCard
                    title="Offer Rate"
                    value={`${analyticsData ? formatPercentage(analyticsData.responseRates.offerRate / 100) : '0%'}`}
                    description="Applications that led to offers"
                  />
                </>
              )}
            </div>

            {/* Time to response stats */}
            <div className="grid gap-4 md:grid-cols-3">
              {loading ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i} className="p-6">
                      <Skeleton className="h-8 w-28 mb-2" />
                      <Skeleton className="h-14 w-full" />
                    </Card>
                  ))
              ) : (
                <>
                  <StatCard
                    title="Avg. Days to Response"
                    value={
                      analyticsData?.timeToResponse.averageDaysToFirstResponse?.toFixed(
                        1,
                      ) || 'N/A'
                    }
                    description="From application submission to first response"
                  />
                  <StatCard
                    title="Avg. Days to Interview"
                    value={
                      analyticsData?.timeToResponse.averageDaysToInterview?.toFixed(
                        1,
                      ) || 'N/A'
                    }
                    description="From application submission to first interview"
                  />
                  <StatCard
                    title="Avg. Days to Offer"
                    value={
                      analyticsData?.timeToResponse.averageDaysToOffer?.toFixed(
                        1,
                      ) || 'N/A'
                    }
                    description="From application submission to job offer"
                  />
                </>
              )}
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              {loading ? (
                Array(2)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i} className="p-6">
                      <Skeleton className="h-8 w-28 mb-4" />
                      <Skeleton className="h-80 w-full" />
                    </Card>
                  ))
              ) : (
                <>
                  <StatusDistributionChart data={statusDistributionData} />
                  <ResponseRatesChart data={responseRatesData} />
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="job-boards" className="space-y-6">
            {loading ? (
              <Card className="p-6">
                <Skeleton className="h-8 w-28 mb-4" />
                <Skeleton className="h-80 w-full" />
              </Card>
            ) : (
              <JobProviderPerformanceChart
                data={analyticsData?.jobProviderPerformance || []}
              />
            )}

            {/* Job board details table */}
            <Card>
              <CardHeader>
                <CardTitle>Job Board Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Job Board</th>
                        <th className="text-right py-3 px-4">Applications</th>
                        <th className="text-right py-3 px-4">Response Rate</th>
                        <th className="text-right py-3 px-4">Interview Rate</th>
                        <th className="text-right py-3 px-4">Offer Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading
                        ? Array(3)
                            .fill(0)
                            .map((_, i) => (
                              <tr key={i} className="border-b">
                                <td className="py-3 px-4">
                                  <Skeleton className="h-4 w-24" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                              </tr>
                            ))
                        : analyticsData?.jobProviderPerformance.map(board => (
                            <tr key={board.jobProvider} className="border-b">
                              <td className="py-3 px-4">{board.jobProvider}</td>
                              <td className="py-3 px-4 text-right">
                                {board.applications}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {formatPercentage(board.responseRate / 100)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {formatPercentage(board.interviewRate / 100)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {formatPercentage(board.offerRate / 100)}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resumes" className="space-y-6">
            {loading ? (
              <Card className="p-6">
                <Skeleton className="h-8 w-28 mb-4" />
                <Skeleton className="h-80 w-full" />
              </Card>
            ) : (
              <ResumePerformanceChart
                data={analyticsData?.resumePerformance || []}
              />
            )}

            {/* Resume details table */}
            <Card>
              <CardHeader>
                <CardTitle>Resume Performance Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Resume</th>
                        <th className="text-right py-3 px-4">Applications</th>
                        <th className="text-right py-3 px-4">Responses</th>
                        <th className="text-right py-3 px-4">Interviews</th>
                        <th className="text-right py-3 px-4">Offers</th>
                        <th className="text-right py-3 px-4">Response Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading
                        ? Array(3)
                            .fill(0)
                            .map((_, i) => (
                              <tr key={i} className="border-b">
                                <td className="py-3 px-4">
                                  <Skeleton className="h-4 w-24" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                              </tr>
                            ))
                        : analyticsData?.resumePerformance.map(resume => (
                            <tr key={resume.resumeId} className="border-b">
                              <td className="py-3 px-4">{resume.resumeName}</td>
                              <td className="py-3 px-4 text-right">
                                {resume.applications}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {resume.responses}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {resume.interviews}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {resume.offers}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {formatPercentage(resume.responseRate / 100)}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Trend analysis will be implemented in a future update. This
                  section will show application volume and outcomes over time.
                </p>
                <div className="h-80 w-full flex items-center justify-center border border-dashed rounded-lg">
                  <span className="text-muted-foreground">Coming Soon</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
