'use client';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Info,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ErrorLog {
  id: string;
  timestamp: string;
  category: string;
  severity: string;
  message: string;
  platform?: string;
  jobTitle?: string;
  company?: string;
  attemptNumber?: number;
  resolved: boolean;
  resolvedAt?: string;
  resolutionMethod?: string;
  suggestedAction?: string;
  isRetryable: boolean;
  requiresUserAction: boolean;
}

interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  resolutionRate: number;
  averageResolutionTime: number;
  recentTrend: 'increasing' | 'stable' | 'decreasing';
}

interface ManualInterventionItem {
  id: string;
  jobTitle: string;
  company: string;
  platform: string;
  errorMessage: string;
  queuedAt: string;
  priority: 'low' | 'medium' | 'high';
}

export default function AutomationErrorsPage() {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [statistics, setStatistics] = useState<ErrorStatistics | null>(null);
  const [manualQueue, setManualQueue] = useState<ManualInterventionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchErrorData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchErrorData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchErrorData = async () => {
    try {
      // Fetch error logs
      const logsRes = await fetch('/api/automation/errors');
      const logsData = await logsRes.json();
      setErrorLogs(logsData.errors || []);

      // Fetch statistics
      const statsRes = await fetch('/api/automation/errors/statistics');
      const statsData = await statsRes.json();
      setStatistics(statsData);

      // Fetch manual intervention queue
      const queueRes = await fetch('/api/automation/errors/manual-queue');
      const queueData = await queueRes.json();
      setManualQueue(queueData.queue || []);
    } catch (error) {
      console.error('Error fetching error data:', error);
      toast.error('Failed to load error data');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (errorId: string, applicationId?: string) => {
    setRetryingId(errorId);
    try {
      const res = await fetch('/api/automation/errors/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorId, applicationId }),
      });

      if (res.ok) {
        toast.success('Application scheduled for retry');
        fetchErrorData();
      } else {
        toast.error('Failed to retry application');
      }
    } catch (error) {
      console.error('Error retrying:', error);
      toast.error('Failed to retry application');
    } finally {
      setRetryingId(null);
    }
  };

  const handleResolve = async (errorId: string, method: string) => {
    try {
      const res = await fetch('/api/automation/errors/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorId, resolutionMethod: method }),
      });

      if (res.ok) {
        toast.success('Error marked as resolved');
        fetchErrorData();
      }
    } catch (error) {
      console.error('Error resolving:', error);
      toast.error('Failed to resolve error');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'temporary':
        return <Clock className="h-4 w-4" />;
      case 'permanent':
        return <XCircle className="h-4 w-4" />;
      case 'auth':
        return <AlertCircle className="h-4 w-4" />;
      case 'validation':
        return <AlertTriangle className="h-4 w-4" />;
      case 'platform':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Page name="automation-errors">
      <PageHeader
        title="Error Management"
        description="Monitor and resolve automation errors"
        actions={
          <Button onClick={fetchErrorData} variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <PageContent>
        {/* Statistics Overview */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics.totalErrors}
                </div>
                <div className="flex items-center mt-1">
                  {statistics.recentTrend === 'increasing' ? (
                    <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
                  ) : statistics.recentTrend === 'decreasing' ? (
                    <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <span className="h-4 w-4 mr-1">-</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {statistics.recentTrend}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Resolution Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics.resolutionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg. {statistics.averageResolutionTime.toFixed(0)} min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Manual Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{manualQueue.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requiring intervention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Critical Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {statistics.errorsBySeverity?.critical || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Immediate attention needed
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="recent" className="space-y-4">
          <TabsList>
            <TabsTrigger value="recent">Recent Errors</TabsTrigger>
            <TabsTrigger value="manual">Manual Intervention</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-4">
            {errorLogs.filter(e => !e.resolved).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No active errors</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {errorLogs
                  .filter(e => !e.resolved)
                  .map(error => (
                    <Card key={error.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(error.category)}
                              <h3 className="font-semibold">
                                {error.jobTitle || 'Unknown Job'} at{' '}
                                {error.company || 'Unknown Company'}
                              </h3>
                              <Badge
                                className={cn(getSeverityColor(error.severity))}
                              >
                                {error.severity}
                              </Badge>
                              <Badge variant="outline">{error.category}</Badge>
                              {error.platform && (
                                <Badge variant="secondary">
                                  {error.platform}
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm text-muted-foreground">
                              {error.message}
                            </p>

                            {error.suggestedAction && (
                              <Alert className="mt-2">
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                  {error.suggestedAction}
                                </AlertDescription>
                              </Alert>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(
                                  new Date(error.timestamp),
                                  { addSuffix: true },
                                )}
                              </span>
                              {error.attemptNumber && (
                                <span>Attempt #{error.attemptNumber}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {error.isRetryable && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetry(error.id)}
                                disabled={retryingId === error.id}
                              >
                                {retryingId === error.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Play className="mr-1 h-4 w-4" />
                                    Retry
                                  </>
                                )}
                              </Button>
                            )}

                            <Modal>
                              <ModalTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Eye className="mr-1 h-4 w-4" />
                                  Details
                                </Button>
                              </ModalTrigger>
                              <ModalContent className="max-w-2xl">
                                <ModalHeader>
                                  <ModalTitle>Error Details</ModalTitle>
                                  <ModalDescription>
                                    Full error information and resolution
                                    options
                                  </ModalDescription>
                                </ModalHeader>
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium mb-1">
                                      Error Message
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      {error.message}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-1">
                                      Metadata
                                    </h4>
                                    <div className="text-sm space-y-1">
                                      <p>Category: {error.category}</p>
                                      <p>Severity: {error.severity}</p>
                                      <p>Platform: {error.platform || 'N/A'}</p>
                                      <p>
                                        Timestamp:{' '}
                                        {format(
                                          new Date(error.timestamp),
                                          'PPpp',
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  {error.suggestedAction && (
                                    <div>
                                      <h4 className="font-medium mb-1">
                                        Suggested Action
                                      </h4>
                                      <p className="text-sm text-muted-foreground">
                                        {error.suggestedAction}
                                      </p>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() =>
                                        handleResolve(error.id, 'manual')
                                      }
                                      variant="outline"
                                    >
                                      Mark as Resolved
                                    </Button>
                                    {error.requiresUserAction && (
                                      <Button
                                        onClick={() =>
                                          (window.location.href = `/tools/automation/fix/${error.id}`)
                                        }
                                      >
                                        Fix Manually
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </ModalContent>
                            </Modal>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            {manualQueue.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">
                    No items requiring manual intervention
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {manualQueue.map(item => (
                  <Card key={item.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-orange-500" />
                            <h3 className="font-semibold">
                              {item.jobTitle} at {item.company}
                            </h3>
                            <Badge
                              variant={
                                item.priority === 'high'
                                  ? 'destructive'
                                  : item.priority === 'medium'
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {item.priority} priority
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {item.errorMessage}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Platform: {item.platform}</span>
                            <span>
                              Queued{' '}
                              {formatDistanceToNow(new Date(item.queuedAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>

                        <Button
                          onClick={() =>
                            (window.location.href = `/tools/automation/manual/${item.id}`)
                          }
                        >
                          Review & Fix
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {errorLogs
                  .filter(e => e.resolved)
                  .map(error => (
                    <Card key={error.id} className="opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-medium">
                              {error.jobTitle}
                            </span>
                            <Badge variant="outline">{error.category}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Resolved{' '}
                            {error.resolutionMethod &&
                              `via ${error.resolutionMethod}`}{' '}
                            {error.resolvedAt &&
                              formatDistanceToNow(new Date(error.resolvedAt), {
                                addSuffix: true,
                              })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Errors by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(statistics.errorsByCategory).map(
                        ([category, count]) => (
                          <div
                            key={category}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(category)}
                              <span className="capitalize">{category}</span>
                            </div>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Errors by Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(statistics.errorsBySeverity).map(
                        ([severity, count]) => (
                          <div
                            key={severity}
                            className="flex items-center justify-between"
                          >
                            <Badge className={cn(getSeverityColor(severity))}>
                              {severity}
                            </Badge>
                            <span className="font-medium">{count}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
