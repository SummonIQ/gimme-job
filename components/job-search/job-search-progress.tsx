'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { getJobSearch } from '@/lib/job-searches/query';
import { JobSearchStatus } from '@/generated/prisma/browser';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface JobSearchProgressProps {
  jobSearchId: string;
  onComplete?: (success: boolean) => void;
}

export function JobSearchProgress({
  jobSearchId,
  onComplete,
}: JobSearchProgressProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<JobSearchStatus>(JobSearchStatus.QUEUED);
  const [jobsFound, setJobsFound] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const { toast } = useToast();

  if (status === JobSearchStatus.FAILED) {
    return null;
  }

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchProgress = async () => {
      try {
        const result = await getJobSearch({ id: jobSearchId });

        if (result) {
          setProgress(result.progress || 0);
          setStatus(result.status);

          // Count jobs found
          if (result._count?.jobSearchListings) {
            setJobsFound(result._count.jobSearchListings);
          }

          // Handle completion states
          if (result.status === JobSearchStatus.COMPLETED) {
            setIsPolling(false);
            onComplete?.(true);
            toast({
              title: 'Job search completed',
              description: `Found ${result._count?.jobSearchListings || 0} job listings that match your criteria.`,
              variant: 'default',
            });
          } else if (result.status === JobSearchStatus.FAILED) {
            setIsPolling(false);
            onComplete?.(false);
            toast({
              title: 'Job search failed',
              description: 'There was a problem with your job search.',
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching job search progress:', error);
      }
    };

    // Fetch immediately on mount
    fetchProgress();

    // Start polling if not complete
    if (isPolling) {
      intervalId = setInterval(fetchProgress, 3000); // Poll every 3 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobSearchId, isPolling, onComplete, toast]);

  const getStatusMessage = () => {
    switch (status) {
      case JobSearchStatus.QUEUED:
        return 'Your job search is in queue...';
      case JobSearchStatus.PROCESSING:
        return `Searching for jobs (${jobsFound} found so far)...`;
      case JobSearchStatus.COMPLETED:
        return `Job search completed! Found ${jobsFound} jobs.`;
      case JobSearchStatus.FAILED:
        return 'Job search failed. Please try again.';
      default:
        return 'Processing your job search...';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case JobSearchStatus.QUEUED:
        return <Badge variant="outline">Queued</Badge>;
      case JobSearchStatus.PROCESSING:
        return <Badge variant="secondary">Processing</Badge>;
      case JobSearchStatus.COMPLETED:
        return <Badge variant="default">Completed</Badge>;
      case JobSearchStatus.FAILED:
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Processing</Badge>;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case JobSearchStatus.QUEUED:
      case JobSearchStatus.PROCESSING:
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case JobSearchStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case JobSearchStatus.FAILED:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Job Search Progress</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />

          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            {getStatusIcon()}
            <span>{getStatusMessage()}</span>
          </div>

          <div className="text-xs text-muted-foreground">
            {progress}% complete
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
