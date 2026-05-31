"use client";

import { useState, useEffect } from 'react';
import { Save, Clock, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface RateLimitSettings {
  applicationsPerHour: number;
  applicationsPerDay: number;
  minIntervalMinutes: number;
  maxApplicationsPerCompany: number;
  respectProviderLimits: boolean;
}

export function AutomationRateLimitSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<RateLimitSettings>({
    applicationsPerHour: 10,
    applicationsPerDay: 50,
    minIntervalMinutes: 5,
    maxApplicationsPerCompany: 3,
    respectProviderLimits: true,
  });
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Recommended limits based on job board best practices
  const RECOMMENDED_LIMITS = {
    linkedin: { hourly: 5, daily: 25 },
    indeed: { hourly: 10, daily: 50 },
    glassdoor: { hourly: 8, daily: 40 },
  };

  const MAX_LIMITS = {
    applicationsPerHour: 20,
    applicationsPerDay: 100,
    minIntervalMinutes: 60,
    maxApplicationsPerCompany: 10,
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/automation/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings({
        applicationsPerHour: data.applicationsPerHour,
        applicationsPerDay: data.applicationsPerDay,
        minIntervalMinutes: data.minIntervalMinutes,
        maxApplicationsPerCompany: data.maxApplicationsPerCompany,
        respectProviderLimits: data.respectProviderLimits,
      });
    } catch (error) {
      console.error('Failed to load rate limit settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const handleSettingChange = (key: keyof RateLimitSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) throw new Error('Failed to save settings');
      
      toast({
        title: "Settings Saved",
        description: "Your rate limit settings have been updated successfully.",
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

  const isHourlyRateHigh = settings.applicationsPerHour > 15;
  const isDailyRateHigh = settings.applicationsPerDay > 75;
  const isIntervalTooShort = settings.minIntervalMinutes < 3;

  return (
    <div className="space-y-6">
      {/* Warning for aggressive settings */}
      {(isHourlyRateHigh || isDailyRateHigh || isIntervalTooShort) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your current settings may be too aggressive and could result in account restrictions. 
            Consider using more conservative limits to ensure long-term success.
          </AlertDescription>
        </Alert>
      )}

      {/* Hourly Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hourly Limits
          </CardTitle>
          <CardDescription>
            Control the maximum number of applications submitted per hour
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hourly-limit">Applications per Hour: {settings.applicationsPerHour}</Label>
            <Slider
              id="hourly-limit"
              min={1}
              max={MAX_LIMITS.applicationsPerHour}
              step={1}
              value={[settings.applicationsPerHour]}
              onValueChange={([value]) => handleSettingChange('applicationsPerHour', value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Conservative (1-5)</span>
              <span>Moderate (6-10)</span>
              <span>Aggressive (11+)</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Minimum Interval Between Applications: {settings.minIntervalMinutes} minutes</Label>
            <Slider
              id="interval"
              min={1}
              max={MAX_LIMITS.minIntervalMinutes}
              step={1}
              value={[settings.minIntervalMinutes]}
              onValueChange={([value]) => handleSettingChange('minIntervalMinutes', value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 5+ minutes to avoid appearing as spam
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Daily Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Limits</CardTitle>
          <CardDescription>
            Set the maximum number of applications for a 24-hour period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="daily-limit">Applications per Day: {settings.applicationsPerDay}</Label>
            <Slider
              id="daily-limit"
              min={5}
              max={MAX_LIMITS.applicationsPerDay}
              step={5}
              value={[settings.applicationsPerDay]}
              onValueChange={([value]) => handleSettingChange('applicationsPerDay', value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Conservative (5-25)</span>
              <span>Moderate (30-50)</span>
              <span>Aggressive (55+)</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-limit">Max Applications per Company: {settings.maxApplicationsPerCompany}</Label>
            <Slider
              id="company-limit"
              min={1}
              max={MAX_LIMITS.maxApplicationsPerCompany}
              step={1}
              value={[settings.maxApplicationsPerCompany]}
              onValueChange={([value]) => handleSettingChange('maxApplicationsPerCompany', value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Prevents applying to too many positions at the same company
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Recommendations</CardTitle>
          <CardDescription>
            Suggested limits based on job board best practices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(RECOMMENDED_LIMITS).map(([platform, limits]) => (
              <div key={platform} className="space-y-2 p-3 border rounded-lg">
                <h4 className="font-medium capitalize">{platform}</h4>
                <div className="text-sm text-muted-foreground">
                  <p>Hourly: {limits.hourly}</p>
                  <p>Daily: {limits.daily}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleSettingChange('applicationsPerHour', limits.hourly);
                    handleSettingChange('applicationsPerDay', limits.daily);
                  }}
                  className="w-full"
                >
                  Apply {platform} Limits
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>
            Your application activity today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Applications Today</p>
              <p className="text-2xl font-bold">0 / {settings.applicationsPerDay}</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all" 
                  style={{ width: '0%' }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Applications This Hour</p>
              <p className="text-2xl font-bold">0 / {settings.applicationsPerHour}</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all" 
                  style={{ width: '0%' }}
                />
              </div>
            </div>
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