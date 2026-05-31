'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TimePicker } from '@/components/ui/time-picker';
import { format, isToday, isTomorrow } from 'date-fns';
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ScheduledApplication {
  id: string;
  scheduledFor: string;
  priority: number;
  status: string;
  attemptCount: number;
  jobLead: {
    id: string;
    jobListing: {
      title: string;
      companyName: string;
      location?: string;
      salary?: string;
    };
  };
}

export function AutomationSchedulingDashboard() {
  const [scheduledApplications, setScheduledApplications] = useState<
    ScheduledApplication[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<ScheduledApplication | null>(
    null,
  );
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [newScheduledDate, setNewScheduledDate] = useState<Date | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchScheduledApplications();
    // Refresh every minute to update relative times
    const interval = setInterval(fetchScheduledApplications, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchScheduledApplications = async () => {
    try {
      const response = await fetch(
        '/api/automation/schedule?status=scheduled&limit=50',
      );
      if (response.ok) {
        const data = await response.json();
        setScheduledApplications(data.applications);
      }
    } catch (error) {
      console.error('Error fetching scheduled applications:', error);
      toast.error('Failed to load scheduled applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(`/api/automation/schedule/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Application cancelled');
        fetchScheduledApplications();
      } else {
        toast.error('Failed to cancel application');
      }
    } catch (error) {
      console.error('Error cancelling application:', error);
      toast.error('Failed to cancel application');
    }
  };

  const handleReschedule = async () => {
    if (!selectedApp || !newScheduledDate) return;

    try {
      const response = await fetch(
        `/api/automation/schedule/${selectedApp.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledFor: newScheduledDate.toISOString(),
          }),
        },
      );

      if (response.ok) {
        toast.success('Application rescheduled');
        setShowRescheduleDialog(false);
        setSelectedApp(null);
        setNewScheduledDate(undefined);
        fetchScheduledApplications();
      } else {
        toast.error('Failed to reschedule application');
      }
    } catch (error) {
      console.error('Error rescheduling application:', error);
      toast.error('Failed to reschedule application');
    }
  };

  const getTimeDisplay = (dateString: string) => {
    const date = new Date(dateString);

    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d at h:mm a');
    }
  };

  const getStatusBadge = (status: string, attemptCount: number) => {
    switch (status) {
      case 'scheduled':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Scheduled
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed {attemptCount > 1 && `(${attemptCount} attempts)`}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const groupApplicationsByDay = () => {
    const groups = new Map<string, ScheduledApplication[]>();

    scheduledApplications.forEach(app => {
      const date = new Date(app.scheduledFor);
      const dayKey = format(date, 'yyyy-MM-dd');

      if (!groups.has(dayKey)) {
        groups.set(dayKey, []);
      }
      groups.get(dayKey)?.push(app);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Applications</CardTitle>
          <CardDescription>Loading scheduled applications...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedApplications = groupApplicationsByDay();

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Applications</CardTitle>
              <CardDescription>
                {scheduledApplications.length} applications scheduled
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                fetchScheduledApplications();
              }}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scheduledApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No applications scheduled</p>
              <p className="text-sm mt-2">
                Enable smart scheduling to automatically queue your applications
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {groupedApplications.map(([dayKey, apps]) => {
                  const date = new Date(dayKey);
                  const dayLabel = isToday(date)
                    ? 'Today'
                    : isTomorrow(date)
                      ? 'Tomorrow'
                      : format(date, 'EEEE, MMM d');

                  return (
                    <div key={dayKey}>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                        {dayLabel} · {apps.length} applications
                      </h3>
                      <div className="space-y-3">
                        {apps.map(app => (
                          <div
                            key={app.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium">
                                {app.jobLead.jobListing.title}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {app.jobLead.jobListing.companyName}
                                {app.jobLead.jobListing.location &&
                                  ` · ${app.jobLead.jobListing.location}`}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-sm text-muted-foreground">
                                  <Clock className="inline-block mr-1 h-3 w-3" />
                                  {format(new Date(app.scheduledFor), 'h:mm a')}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  Priority: {app.priority}
                                </span>
                                {getStatusBadge(app.status, app.attemptCount)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedApp(app);
                                  setNewScheduledDate(
                                    new Date(app.scheduledFor),
                                  );
                                  setShowRescheduleDialog(true);
                                }}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(app.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Modal open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Reschedule Application</ModalTitle>
            <ModalDescription>
              Choose a new date and time for this application
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            {selectedApp && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">
                  {selectedApp.jobLead.jobListing.title}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedApp.jobLead.jobListing.companyName}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <CalendarPicker
                mode="single"
                selected={newScheduledDate}
                onSelect={setNewScheduledDate}
                disabled={date => date < new Date()}
                className="rounded-md border"
              />
            </div>
            {newScheduledDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Time</label>
                <TimePicker
                  date={newScheduledDate}
                  setDate={setNewScheduledDate}
                />
              </div>
            )}
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setShowRescheduleDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={!newScheduledDate}>
              Reschedule
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
