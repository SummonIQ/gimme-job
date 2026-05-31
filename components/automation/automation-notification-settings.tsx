"use client";

import { useState, useEffect } from 'react';
import { Save, Bell, Mail, Smartphone, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettings {
  // Application Status Notifications
  applicationSubmitted: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  applicationFailed: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  applicationApprovalRequired: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  
  // Automation Status Notifications
  automationStarted: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  automationPaused: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  automationError: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  
  // Rate Limit Notifications
  rateLimitApproaching: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  rateLimitReached: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  
  // Summary Notifications
  dailySummary: {
    enabled: boolean;
    time: string; // HH:MM format
    email: boolean;
  };
  weeklySummary: {
    enabled: boolean;
    day: string; // Monday, Tuesday, etc.
    time: string;
    email: boolean;
  };
  
  // General Settings
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  notificationFrequency: 'immediate' | 'batched' | 'minimal';
}

const defaultSettings: NotificationSettings = {
  applicationSubmitted: { inApp: true, email: false, push: true },
  applicationFailed: { inApp: true, email: true, push: true },
  applicationApprovalRequired: { inApp: true, email: true, push: true },
  automationStarted: { inApp: true, email: false, push: false },
  automationPaused: { inApp: true, email: true, push: true },
  automationError: { inApp: true, email: true, push: true },
  rateLimitApproaching: { inApp: true, email: false, push: false },
  rateLimitReached: { inApp: true, email: true, push: true },
  dailySummary: { enabled: true, time: '18:00', email: true },
  weeklySummary: { enabled: true, day: 'Sunday', time: '09:00', email: true },
  quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
  notificationFrequency: 'immediate',
};

export function AutomationNotificationSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // TODO: Implement API call to fetch settings
      // For now, using default settings
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const handleNotificationChange = (
    category: keyof NotificationSettings,
    channel: 'inApp' | 'email' | 'push',
    enabled: boolean
  ) => {
    if (typeof settings[category] === 'object' && 'inApp' in settings[category]) {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [channel]: enabled,
        },
      }));
      setHasChanges(true);
    }
  };

  const handleSummaryChange = (
    type: 'dailySummary' | 'weeklySummary',
    key: string,
    value: any
  ) => {
    setSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleQuietHoursChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      
      toast({
        title: "Settings Saved",
        description: "Your notification preferences have been updated successfully.",
      });
      setHasChanges(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const NotificationRow = ({ 
    title, 
    description, 
    category 
  }: { 
    title: string; 
    description: string; 
    category: keyof NotificationSettings 
  }) => {
    const categorySettings = settings[category];
    
    if (typeof categorySettings !== 'object' || !('inApp' in categorySettings)) {
      return null;
    }

    return (
      <div className="flex items-center justify-between py-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-3 w-3" />
            <Switch
              checked={categorySettings.inApp}
              onCheckedChange={(checked) => handleNotificationChange(category, 'inApp', checked)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3" />
            <Switch
              checked={categorySettings.email}
              onCheckedChange={(checked) => handleNotificationChange(category, 'email', checked)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-3 w-3" />
            <Switch
              checked={categorySettings.push}
              onCheckedChange={(checked) => handleNotificationChange(category, 'push', checked)}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Notification Channels Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <span>In-App</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>Push</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application Events */}
      <Card>
        <CardHeader>
          <CardTitle>Application Events</CardTitle>
          <CardDescription>
            Notifications for individual application status changes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <NotificationRow
            title="Application Submitted"
            description="When an application is successfully submitted"
            category="applicationSubmitted"
          />
          <NotificationRow
            title="Application Failed"
            description="When an application fails to submit"
            category="applicationFailed"
          />
          <NotificationRow
            title="Approval Required"
            description="When an application needs your approval"
            category="applicationApprovalRequired"
          />
        </CardContent>
      </Card>

      {/* Automation Events */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Events</CardTitle>
          <CardDescription>
            Notifications for automation system status changes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <NotificationRow
            title="Automation Started"
            description="When automation begins running"
            category="automationStarted"
          />
          <NotificationRow
            title="Automation Paused"
            description="When automation is paused or stopped"
            category="automationPaused"
          />
          <NotificationRow
            title="Automation Error"
            description="When automation encounters an error"
            category="automationError"
          />
        </CardContent>
      </Card>

      {/* Rate Limit Events */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Events</CardTitle>
          <CardDescription>
            Notifications for rate limiting status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <NotificationRow
            title="Rate Limit Approaching"
            description="When you're near your daily/hourly limits"
            category="rateLimitApproaching"
          />
          <NotificationRow
            title="Rate Limit Reached"
            description="When you've reached your limits"
            category="rateLimitReached"
          />
        </CardContent>
      </Card>

      {/* Summary Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Reports</CardTitle>
          <CardDescription>
            Periodic summaries of your automation activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Daily Summary</Label>
              <p className="text-sm text-muted-foreground">
                Daily report of application activity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.dailySummary.enabled}
                onCheckedChange={(checked) => handleSummaryChange('dailySummary', 'enabled', checked)}
              />
              {settings.dailySummary.enabled && (
                <Select
                  value={settings.dailySummary.time}
                  onValueChange={(value) => handleSummaryChange('dailySummary', 'time', value)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08:00">8:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="18:00">6:00 PM</SelectItem>
                    <SelectItem value="20:00">8:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Summary</Label>
              <p className="text-sm text-muted-foreground">
                Weekly report of application activity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.weeklySummary.enabled}
                onCheckedChange={(checked) => handleSummaryChange('weeklySummary', 'enabled', checked)}
              />
              {settings.weeklySummary.enabled && (
                <Select
                  value={settings.weeklySummary.day}
                  onValueChange={(value) => handleSummaryChange('weeklySummary', 'day', value)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sunday">Sunday</SelectItem>
                    <SelectItem value="Monday">Monday</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Overall notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                Suppress notifications during these hours
              </p>
            </div>
            <Switch
              checked={settings.quietHours.enabled}
              onCheckedChange={(checked) => handleQuietHoursChange('enabled', checked)}
            />
          </div>

          {settings.quietHours.enabled && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>From:</Label>
                <Select
                  value={settings.quietHours.startTime}
                  onValueChange={(value) => handleQuietHoursChange('startTime', value)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="22:00">10:00 PM</SelectItem>
                    <SelectItem value="23:00">11:00 PM</SelectItem>
                    <SelectItem value="00:00">12:00 AM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>To:</Label>
                <Select
                  value={settings.quietHours.endTime}
                  onValueChange={(value) => handleQuietHoursChange('endTime', value)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="06:00">6:00 AM</SelectItem>
                    <SelectItem value="07:00">7:00 AM</SelectItem>
                    <SelectItem value="08:00">8:00 AM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notification Frequency</Label>
              <p className="text-sm text-muted-foreground">
                How often to receive notifications
              </p>
            </div>
            <Select
              value={settings.notificationFrequency}
              onValueChange={(value: 'immediate' | 'batched' | 'minimal') => {
                setSettings(prev => ({ ...prev, notificationFrequency: value }));
                setHasChanges(true);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="batched">Batched</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSaveSettings}
          disabled={!hasChanges || loading}
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}