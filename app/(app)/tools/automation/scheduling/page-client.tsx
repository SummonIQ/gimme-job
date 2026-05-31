'use client';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTimeInTimezone } from '@/lib/time/timezone';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  RefreshCw,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ScheduledApplication {
  id: string;
  jobLeadId: string;
  jobTitle: string;
  companyName?: string;
  platform?: string;
  scheduledFor: string;
  priority: number;
  status: string;
  optimalityScore?: number;
  metadata?: {
    competitionLevel?: string;
    urgencyLevel?: string;
    schedulingReason?: string;
    estimatedVisibility?: string;
  };
}

interface SchedulingAnalytics {
  totalScheduled: number;
  todayScheduled: number;
  weekScheduled: number;
  averageOptimalityScore: number;
  platformDistribution: Record<string, number>;
  hourlyDistribution: number[];
  upcomingOptimalSlots: Array<{ time: string; score: number }>;
}

export default function SchedulingDashboard() {
  const [scheduledApplications, setScheduledApplications] = useState<
    ScheduledApplication[]
  >([]);
  const [analytics, setAnalytics] = useState<SchedulingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<
    'timeline' | 'calendar' | 'analytics'
  >('timeline');
  const [userTimezone, setUserTimezone] = useState('America/New_York');

  useEffect(() => {
    fetchSchedulingData();
    // Detect user timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(tz);
  }, []);

  const fetchSchedulingData = async () => {
    try {
      setLoading(true);

      // Fetch scheduled applications
      const scheduledRes = await fetch('/api/automation/scheduled');
      const scheduledData = await scheduledRes.json();
      setScheduledApplications(scheduledData.applications || []);

      // Fetch analytics
      const analyticsRes = await fetch('/api/automation/scheduling/analytics');
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching scheduling data:', error);
      toast.error('Failed to load scheduling data');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (applicationId: string) => {
    try {
      const res = await fetch(
        `/api/automation/scheduled/${applicationId}/reschedule`,
        {
          method: 'POST',
        },
      );

      if (res.ok) {
        toast.success('Application rescheduled successfully');
        fetchSchedulingData();
      } else {
        toast.error('Failed to reschedule application');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('Failed to reschedule application');
    }
  };

  const handleCancel = async (applicationId: string) => {
    try {
      const res = await fetch(`/api/automation/scheduled/${applicationId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Scheduled application cancelled');
        fetchSchedulingData();
      } else {
        toast.error('Failed to cancel application');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      toast.error('Failed to cancel application');
    }
  };

  const getOptimalityColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getOptimalityLabel = (score?: number) => {
    if (!score) return 'Unknown';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const renderTimelineView = () => (
    <div className="space-y-4">
      {scheduledApplications.map((app, index) => (
        <Card key={app.id} className="relative">
          {index === 0 && (
            <div className="absolute -top-2 -left-2">
              <Badge variant="default" className="bg-blue-600">
                Next Up
              </Badge>
            </div>
          )}
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(app.status)}
                  <h3 className="font-semibold text-lg">{app.jobTitle}</h3>
                  {app.platform && (
                    <Badge variant="outline">{app.platform}</Badge>
                  )}
                </div>

                {app.companyName && (
                  <p className="text-sm text-muted-foreground">
                    {app.companyName}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDateTimeInTimezone(
                        app.scheduledFor,
                        userTimezone,
                        {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </span>
                  </div>

                  {app.optimalityScore !== undefined && (
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      <span
                        className={cn(
                          'font-medium',
                          getOptimalityColor(app.optimalityScore),
                        )}
                      >
                        {getOptimalityLabel(app.optimalityScore)} (
                        {app.optimalityScore}%)
                      </span>
                    </div>
                  )}
                </div>

                {app.metadata && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {app.metadata.competitionLevel && (
                      <Badge variant="secondary" className="text-xs">
                        Competition: {app.metadata.competitionLevel}
                      </Badge>
                    )}
                    {app.metadata.urgencyLevel && (
                      <Badge variant="secondary" className="text-xs">
                        Urgency: {app.metadata.urgencyLevel}
                      </Badge>
                    )}
                    {app.metadata.estimatedVisibility && (
                      <Badge variant="secondary" className="text-xs">
                        Visibility: {app.metadata.estimatedVisibility}
                      </Badge>
                    )}
                  </div>
                )}

                {app.metadata?.schedulingReason && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {app.metadata.schedulingReason}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {app.status === 'scheduled' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReschedule(app.id)}
                    >
                      Reschedule
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancel(app.id)}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {scheduledApplications.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No applications scheduled</p>
            <Button
              className="mt-4"
              onClick={() => (window.location.href = '/tools/automation')}
            >
              Schedule Applications
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderAnalyticsView = () => {
    if (!analytics) return null;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.totalScheduled}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.todayScheduled}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.weekScheduled}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Avg. Optimality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-2xl font-bold',
                  getOptimalityColor(analytics.averageOptimalityScore),
                )}
              >
                {analytics.averageOptimalityScore.toFixed(0)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
            <CardDescription>
              Applications scheduled by platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(analytics.platformDistribution).map(
                ([platform, count]) => (
                  <div
                    key={platform}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">{platform}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / analytics.totalScheduled) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        {/* Hourly Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Hourly Distribution</CardTitle>
            <CardDescription>
              Applications scheduled by hour of day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-32 gap-1">
              {analytics.hourlyDistribution.map((count, hour) => (
                <div
                  key={hour}
                  className="flex-1 bg-blue-600 rounded-t hover:bg-blue-700 transition-colors relative group"
                  style={{
                    height: `${(count / Math.max(...analytics.hourlyDistribution, 1)) * 100}%`,
                    minHeight: count > 0 ? '4px' : '0',
                  }}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      {hour}:00 - {count} apps
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>11 PM</span>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Optimal Slots */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Optimal Time Slots</CardTitle>
            <CardDescription>
              Best times for scheduling new applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.upcomingOptimalSlots.map((slot, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className={cn('h-4 w-4', getOptimalityColor(slot.score))}
                    />
                    <span className="text-sm">
                      {formatDateTimeInTimezone(slot.time, userTimezone, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(getOptimalityColor(slot.score))}
                  >
                    {slot.score}% optimal
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Page name="automation-scheduling">
      <PageHeader
        title="Intelligent Scheduling Dashboard"
        description="Optimize your application timing for maximum visibility"
        actions={
          <Button
            onClick={fetchSchedulingData}
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />
      <PageContent>
        <Tabs
          value={selectedView}
          onValueChange={v => setSelectedView(v as any)}
        >
          <TabsList>
            <TabsTrigger value="timeline">
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              renderTimelineView()
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              renderAnalyticsView()
            )}
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
