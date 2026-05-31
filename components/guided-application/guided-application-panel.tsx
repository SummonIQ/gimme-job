'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  cancelGuidedApplication,
  enqueueDesktopSubmitRequest,
  getGuidedApplicationProgress,
  pauseGuidedApplication,
  resumeGuidedApplication,
  updateFieldSuggestion,
} from '@/lib/guided-applications/session';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { AssistPreviewSubmitBanner } from '../job-applications/assist-preview-submit-banner';
import { FieldSuggestionCard } from './field-suggestion-card';

interface GuidedApplicationPanelProps {
  applicationId: string;
  onClose?: () => void;
}

const GuidedApplicationPanel = ({
  applicationId,
  onClose,
}: GuidedApplicationPanelProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [desktopQueueError, setDesktopQueueError] = useState<string | null>(
    null,
  );
  const [applicationData, setApplicationData] = useState<{
    applicationId: string;
    status: string;
    currentStep: number;
    totalSteps?: number;
    progress: number;
    desktopQueueItemId?: string;
    jobLeadId?: string;
    screenshotUrl?: string;
    fields: Array<{
      id: string;
      fieldName: string;
      fieldLabel?: string;
      status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'SKIPPED';
      suggestedValue?: string;
      userValue?: string;
      isRequired: boolean;
    }>;
    error?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApplicationData();
    const interval = setInterval(loadApplicationData, 5000);
    return () => clearInterval(interval);
  }, [applicationId]);

  const loadApplicationData = async () => {
    try {
      const data = await getGuidedApplicationProgress(applicationId);
      if (data) {
        setApplicationData(data as typeof applicationData);
      }
    } catch (error) {
      console.error('Failed to load application data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (suggestionId: string) => {
    startTransition(async () => {
      await updateFieldSuggestion(suggestionId, 'ACCEPTED');
      await loadApplicationData();
    });
  };

  const handleReject = async (suggestionId: string) => {
    startTransition(async () => {
      await updateFieldSuggestion(suggestionId, 'REJECTED');
      await loadApplicationData();
    });
  };

  const handleModify = async (suggestionId: string, value: string) => {
    startTransition(async () => {
      await updateFieldSuggestion(suggestionId, 'MODIFIED', value);
      await loadApplicationData();
    });
  };

  const handleSkip = async (suggestionId: string) => {
    startTransition(async () => {
      await updateFieldSuggestion(suggestionId, 'SKIPPED');
      await loadApplicationData();
    });
  };

  const handlePause = async () => {
    startTransition(async () => {
      await pauseGuidedApplication(applicationId);
      await loadApplicationData();
    });
  };

  const handleResume = async () => {
    startTransition(async () => {
      await resumeGuidedApplication(applicationId);
      await loadApplicationData();
    });
  };

  const handleCancel = async () => {
    startTransition(async () => {
      await cancelGuidedApplication(applicationId);
      setShowCancelDialog(false);
      onClose?.();
      router.push('/applications');
    });
  };

  const handleSendToDesktopQueue = async () => {
    setDesktopQueueError(null);
    startTransition(async () => {
      const result = await enqueueDesktopSubmitRequest(applicationId);
      if (!result.success) {
        setDesktopQueueError(result.error ?? 'Failed to send to desktop queue');
        return;
      }
      await loadApplicationData();
    });
  };

  const getStatusBadge = () => {
    const status = applicationData?.status;
    switch (status) {
      case 'ANALYZING':
        return <Badge variant="secondary">Analyzing Form...</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default">In Progress</Badge>;
      case 'PAUSED':
        return <Badge variant="outline">Paused</Badge>;
      case 'READY_TO_SUBMIT':
        return <Badge variant="secondary">Preview Complete</Badge>;
      case 'SUBMITTING':
        return <Badge variant="secondary">Recording...</Badge>;
      case 'SUBMITTED':
        return <Badge variant="secondary">Submission Recorded</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingFields =
    applicationData?.fields.filter(f => f.status === 'PENDING') ?? [];
  const completedFields =
    applicationData?.fields.filter(f => f.status !== 'PENDING') ?? [];
  const isReadyToSubmit = applicationData?.status === 'READY_TO_SUBMIT';
  const isPaused = applicationData?.status === 'PAUSED';
  const isAnalyzing = applicationData?.status === 'ANALYZING';
  const isSubmitting = applicationData?.status === 'SUBMITTING';
  const desktopQueueItemId = applicationData?.desktopQueueItemId;
  const canSendToDesktopQueue =
    Boolean(applicationData?.jobLeadId) &&
    isReadyToSubmit &&
    !desktopQueueItemId;

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!applicationData) {
    return (
      <Card className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Application not found</p>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Guided Application
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                {getStatusBadge()}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{applicationData.progress}%</span>
            </div>
            <Progress value={applicationData.progress} className="h-2" />
          </div>

          {applicationData.error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{applicationData.error}</p>
            </div>
          )}

          {desktopQueueError && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{desktopQueueError}</p>
            </div>
          )}
        </CardHeader>

        <Separator />

        <ScrollArea className="flex-1 p-4">
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Analyzing application form...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take a moment while we detect form fields
              </p>
            </div>
          )}

          {!isAnalyzing && pendingFields.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">Fields to Review</h3>
                <Badge variant="secondary">{pendingFields.length}</Badge>
              </div>
              <div className="space-y-3">
                {pendingFields.map(field => (
                  <FieldSuggestionCard
                    key={field.id}
                    id={field.id}
                    fieldName={field.fieldName}
                    fieldLabel={field.fieldLabel}
                    fieldType="text"
                    suggestedValue={field.suggestedValue}
                    userValue={field.userValue}
                    status={field.status}
                    isRequired={field.isRequired}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onModify={handleModify}
                    onSkip={handleSkip}
                    disabled={isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {!isAnalyzing && completedFields.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-muted-foreground">
                  Completed Fields
                </h3>
                <Badge variant="outline">{completedFields.length}</Badge>
              </div>
              <div className="space-y-3 opacity-75">
                {completedFields.map(field => (
                  <FieldSuggestionCard
                    key={field.id}
                    id={field.id}
                    fieldName={field.fieldName}
                    fieldLabel={field.fieldLabel}
                    fieldType="text"
                    suggestedValue={field.suggestedValue}
                    userValue={field.userValue}
                    status={field.status}
                    isRequired={field.isRequired}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onModify={handleModify}
                    onSkip={handleSkip}
                    disabled={true}
                  />
                ))}
              </div>
            </div>
          )}

          {isReadyToSubmit && pendingFields.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium">Preview Complete</p>
              <p className="text-muted-foreground text-center text-sm">
                All fields have been reviewed. Submit via the desktop runtime or
                manually.
              </p>
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="p-4 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={isPending || isSubmitting}
              >
                Cancel
              </Button>
              {isPaused ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResume}
                  disabled={isPending}
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  disabled={isPending || isAnalyzing || isSubmitting}
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
            </div>
            <Button
              onClick={handleSendToDesktopQueue}
              disabled={!canSendToDesktopQueue || isPending || isSubmitting}
            >
              {desktopQueueItemId
                ? 'Sent to desktop queue'
                : isReadyToSubmit
                  ? 'Send to desktop queue'
                  : 'Review fields first'}
            </Button>
          </div>
          <AssistPreviewSubmitBanner className="mt-3" />
        </div>
      </Card>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Application?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this guided application? Your
              progress will be saved and you can resume later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Working</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              Cancel Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
GuidedApplicationPanel.displayName = 'GuidedApplicationPanel';

export { GuidedApplicationPanel };
