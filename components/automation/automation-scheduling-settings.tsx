'use client';

import { useState, useEffect } from 'react';
import { Save, Calendar, Clock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface SchedulingSettings {
  enableSmartScheduling: boolean;
  scheduleWeekdaysOnly: boolean;
  scheduleBusinessHoursOnly: boolean;
  preferredStartHour: number;
  preferredEndHour: number;
  userTimezone: string;
  prioritizeNewListings: boolean;
}

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona Time' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

export function AutomationSchedulingSettings() {
  const [settings, setSettings] = useState<SchedulingSettings>({
    enableSmartScheduling: true,
    scheduleWeekdaysOnly: true,
    scheduleBusinessHoursOnly: true,
    preferredStartHour: 9,
    preferredEndHour: 17,
    userTimezone: 'America/New_York',
    prioritizeNewListings: true,
  });
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/automation/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings({
            enableSmartScheduling: data.settings.enableSmartScheduling ?? true,
            scheduleWeekdaysOnly: data.settings.scheduleWeekdaysOnly ?? true,
            scheduleBusinessHoursOnly: data.settings.scheduleBusinessHoursOnly ?? true,
            preferredStartHour: data.settings.preferredStartHour ?? 9,
            preferredEndHour: data.settings.preferredEndHour ?? 17,
            userTimezone: data.settings.userTimezone ?? 'America/New_York',
            prioritizeNewListings: data.settings.prioritizeNewListings ?? true,
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load scheduling settings');
    }
  };

  const updateSetting = <K extends keyof SchedulingSettings>(
    key: K,
    value: SchedulingSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Scheduling settings saved successfully');
        setHasChanges(false);
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduling Settings
        </CardTitle>
        <CardDescription>
          Configure how and when applications are automatically submitted
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Smart Scheduling Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="smart-scheduling" className="text-base">
              Enable Smart Scheduling
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically distribute applications across optimal time windows
            </p>
          </div>
          <Switch
            id="smart-scheduling"
            checked={settings.enableSmartScheduling}
            onCheckedChange={(checked) => updateSetting('enableSmartScheduling', checked)}
          />
        </div>

        {settings.enableSmartScheduling && (
          <>
            {/* Weekdays Only */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekdays-only" className="text-base">
                  Weekdays Only
                </Label>
                <p className="text-sm text-muted-foreground">
                  Only submit applications Monday through Friday
                </p>
              </div>
              <Switch
                id="weekdays-only"
                checked={settings.scheduleWeekdaysOnly}
                onCheckedChange={(checked) => updateSetting('scheduleWeekdaysOnly', checked)}
              />
            </div>

            {/* Business Hours Only */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="business-hours" className="text-base">
                  Business Hours Only
                </Label>
                <p className="text-sm text-muted-foreground">
                  Submit applications during typical business hours
                </p>
              </div>
              <Switch
                id="business-hours"
                checked={settings.scheduleBusinessHoursOnly}
                onCheckedChange={(checked) => updateSetting('scheduleBusinessHoursOnly', checked)}
              />
            </div>

            {/* Business Hours Range */}
            {settings.scheduleBusinessHoursOnly && (
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Business Hours</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set your preferred submission window
                  </p>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Start Hour</span>
                        <Badge variant="secondary">{formatHour(settings.preferredStartHour)}</Badge>
                      </div>
                      <Slider
                        value={[settings.preferredStartHour]}
                        onValueChange={([value]) => updateSetting('preferredStartHour', value)}
                        min={0}
                        max={23}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">End Hour</span>
                        <Badge variant="secondary">{formatHour(settings.preferredEndHour)}</Badge>
                      </div>
                      <Slider
                        value={[settings.preferredEndHour]}
                        onValueChange={([value]) => updateSetting('preferredEndHour', value)}
                        min={0}
                        max={23}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Timezone Selection */}
            <div className="space-y-2">
              <Label htmlFor="timezone" className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Your Timezone
              </Label>
              <Select
                value={settings.userTimezone}
                onValueChange={(value) => updateSetting('userTimezone', value)}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Applications will be scheduled based on this timezone
              </p>
            </div>

            {/* Prioritize New Listings */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="prioritize-new" className="text-base">
                  Prioritize New Listings
                </Label>
                <p className="text-sm text-muted-foreground">
                  Apply to newer job postings first for better visibility
                </p>
              </div>
              <Switch
                id="prioritize-new"
                checked={settings.prioritizeNewListings}
                onCheckedChange={(checked) => updateSetting('prioritizeNewListings', checked)}
              />
            </div>
          </>
        )}

        {/* Platform-Specific Timing */}
        <div className="rounded-lg bg-muted p-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Platform Best Practices
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• LinkedIn: Best response rates 9-11 AM on Tuesdays</li>
            <li>• Indeed: Highest visibility 10 AM - 2 PM weekdays</li>
            <li>• Company sites: Early morning submissions (7-9 AM) often reviewed first</li>
          </ul>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={saveSettings}
            disabled={loading || !hasChanges}
            className="min-w-[120px]"
          >
            {loading ? (
              'Saving...'
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}