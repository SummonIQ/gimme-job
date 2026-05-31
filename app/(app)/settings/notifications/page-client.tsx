'use client';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  getBrowserNotificationPreference,
  requestNotificationPermission,
  saveBrowserNotificationPreference,
} from '@/lib/notifications/browser';
import { AlertCircle, Bell, Check, Globe, Loader2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface NotificationSettingsPageProps {
  userId: string;
  initialPreferences: {
    applicationStatusEnabled: boolean;
    interviewRequestsEnabled: boolean;
    networkingRemindersEnabled: boolean;
    shareNotificationsEnabled: boolean;
    resumeFeedbackEnabled: boolean;
    systemNotificationsEnabled: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    browserEnabled: boolean;
  };
}

export default function NotificationSettingsPage({
  userId,
  initialPreferences,
}: NotificationSettingsPageProps) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(initialPreferences);

  // Handle preference change
  const handleToggle = (key: string) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  // Handle browser permission request
  const [browserPermission, setBrowserPermission] =
    useState<NotificationPermission>('default');
  const [browserEnabled, setBrowserEnabled] = useState(false);

  // Check browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if browser supports notifications
      if ('Notification' in window) {
        setBrowserPermission(Notification.permission);
        setBrowserEnabled(getBrowserNotificationPreference());
      }
    }
  }, []);

  // Request browser notification permission
  const handleRequestPermission = async () => {
    try {
      const permission = await requestNotificationPermission();
      setBrowserPermission(permission);

      if (permission === 'granted') {
        // Save preference if permission granted
        saveBrowserNotificationPreference(true);
        setBrowserEnabled(true);
        // Update UI state to reflect enabled browser notifications
        setPreferences(prev => ({
          ...prev,
          browserEnabled: true,
        }));
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setError('Failed to request notification permission.');
    }
  };

  // Toggle browser notifications
  const handleToggleBrowserNotifications = (enabled: boolean) => {
    setBrowserEnabled(enabled);
    saveBrowserNotificationPreference(enabled);
    setPreferences(prev => ({
      ...prev,
      browserEnabled: enabled,
    }));
  };

  // Save preferences
  const handleSave = async () => {
    if (!userId) return;

    try {
      setSaving(true);
      setSuccess(false);
      setError(null);

      const response = await fetch('/api/notifications/preferences', {
        body: JSON.stringify(preferences),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Failed to update notification preferences.');
      }

      // Also save browser notification preference
      saveBrowserNotificationPreference(preferences.browserEnabled);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      setError('Failed to update notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page name="notification-settings" title="Notification Settings">
      <PageHeader
        title="Notification Settings"
        description="Configure how you want to receive updates."
      />
      <PageContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">
              Your notification preferences have been updated successfully.
            </AlertDescription>
          </Alert>
        )}

        {/* Notification Channels */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="mr-2 h-5 w-5" />
              Notification Channels
            </CardTitle>
            <CardDescription>
              Choose how you want to receive notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="inAppEnabled" className="font-medium">
                  In-App Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications within the application.
                </p>
              </div>
              <Switch
                id="inAppEnabled"
                checked={preferences.inAppEnabled}
                onCheckedChange={() => handleToggle('inAppEnabled')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="emailEnabled" className="font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email.
                </p>
              </div>
              <Switch
                id="emailEnabled"
                checked={preferences.emailEnabled}
                onCheckedChange={() => handleToggle('emailEnabled')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="browserEnabled" className="font-medium">
                  Browser Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive push notifications in your browser.
                </p>
                {browserPermission !== 'granted' && (
                  <p className="text-xs text-yellow-500 flex items-center mt-1">
                    <Lock className="h-3 w-3 mr-1" />
                    Permission required
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {browserPermission !== 'granted' ? (
                  <Button
                    size="sm"
                    onClick={handleRequestPermission}
                    variant="outline"
                  >
                    Request Permission
                  </Button>
                ) : (
                  <Switch
                    id="browserEnabled"
                    checked={browserEnabled}
                    onCheckedChange={handleToggleBrowserNotifications}
                    disabled={browserPermission !== 'granted'}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Categories */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Notification Types
            </CardTitle>
            <CardDescription>
              Choose which types of notifications you want to receive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="applicationStatusEnabled"
                  className="font-medium"
                >
                  Application Status Updates
                </Label>
                <p className="text-sm text-muted-foreground">
                  Notifications about changes to your job applications.
                </p>
              </div>
              <Switch
                id="applicationStatusEnabled"
                checked={preferences.applicationStatusEnabled}
                onCheckedChange={() => handleToggle('applicationStatusEnabled')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="interviewRequestsEnabled"
                  className="font-medium"
                >
                  Interview Requests
                </Label>
                <p className="text-sm text-muted-foreground">
                  Notifications about interview invitations and schedules.
                </p>
              </div>
              <Switch
                id="interviewRequestsEnabled"
                checked={preferences.interviewRequestsEnabled}
                onCheckedChange={() => handleToggle('interviewRequestsEnabled')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="networkingRemindersEnabled"
                  className="font-medium"
                >
                  Networking Reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reminders about networking contacts and follow-ups.
                </p>
              </div>
              <Switch
                id="networkingRemindersEnabled"
                checked={preferences.networkingRemindersEnabled}
                onCheckedChange={() =>
                  handleToggle('networkingRemindersEnabled')
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="resumeFeedbackEnabled" className="font-medium">
                  Resume Feedback
                </Label>
                <p className="text-sm text-muted-foreground">
                  Notifications about feedback on your resumes.
                </p>
              </div>
              <Switch
                id="resumeFeedbackEnabled"
                checked={preferences.resumeFeedbackEnabled}
                onCheckedChange={() => handleToggle('resumeFeedbackEnabled')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="shareNotificationsEnabled"
                  className="font-medium"
                >
                  Sharing Activity
                </Label>
                <p className="text-sm text-muted-foreground">
                  Notifications about shared job leads and resumes.
                </p>
              </div>
              <Switch
                id="shareNotificationsEnabled"
                checked={preferences.shareNotificationsEnabled}
                onCheckedChange={() =>
                  handleToggle('shareNotificationsEnabled')
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="systemNotificationsEnabled"
                  className="font-medium"
                >
                  System Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Important system updates and announcements.
                </p>
              </div>
              <Switch
                id="systemNotificationsEnabled"
                checked={preferences.systemNotificationsEnabled}
                onCheckedChange={() =>
                  handleToggle('systemNotificationsEnabled')
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </PageContent>
    </Page>
  );
}
