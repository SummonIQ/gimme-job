"use client";

import { useState, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface SafetySettings {
  requireUserApproval: boolean;
  preventDuplicateApplications: boolean;
  enableCompanyBlacklist: boolean;
  companyBlacklist: string[];
  enableKeywordBlacklist: boolean;
  keywordBlacklist: string[];
  enableSalaryThreshold: boolean;
  minSalaryThreshold: number;
  maxApplicationsPerCompany: number;
  pauseOnConsecutiveFailures: boolean;
  consecutiveFailureThreshold: number;
}

export function AutomationSafetySettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SafetySettings>({
    requireUserApproval: true,
    preventDuplicateApplications: true,
    enableCompanyBlacklist: false,
    companyBlacklist: [],
    enableKeywordBlacklist: false,
    keywordBlacklist: [],
    enableSalaryThreshold: false,
    minSalaryThreshold: 50000,
    maxApplicationsPerCompany: 3,
    pauseOnConsecutiveFailures: true,
    consecutiveFailureThreshold: 3,
  });
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/automation/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings({
        requireUserApproval: data.requireUserApproval,
        preventDuplicateApplications: data.preventDuplicateApplications,
        enableCompanyBlacklist: data.enableCompanyBlacklist,
        companyBlacklist: data.companyBlacklist || [],
        enableKeywordBlacklist: data.enableKeywordBlacklist,
        keywordBlacklist: data.keywordBlacklist || [],
        enableSalaryThreshold: data.enableSalaryThreshold,
        minSalaryThreshold: data.minSalaryThreshold,
        maxApplicationsPerCompany: data.maxApplicationsPerCompany,
        pauseOnConsecutiveFailures: data.pauseOnConsecutiveFailures,
        consecutiveFailureThreshold: data.consecutiveFailureThreshold,
      });
    } catch (error) {
      console.error('Failed to load safety settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const handleSettingChange = (key: keyof SafetySettings, value: any) => {
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
        description: "Your safety settings have been updated successfully.",
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

  return (
    <div className="space-y-6">
      {/* Core Safety Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Core Safety Controls
          </CardTitle>
          <CardDescription>
            Essential safety measures that cannot be disabled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-approval">Require User Approval</Label>
              <p className="text-sm text-muted-foreground">
                All applications must be manually approved before submission
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="require-approval"
                checked={settings.requireUserApproval}
                onCheckedChange={(checked) => handleSettingChange('requireUserApproval', checked)}
              />
              <Badge variant="secondary">Recommended</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="prevent-duplicates">Prevent Duplicate Applications</Label>
              <p className="text-sm text-muted-foreground">
                Automatically skip jobs you've already applied to
              </p>
            </div>
            <Switch
              id="prevent-duplicates"
              checked={settings.preventDuplicateApplications}
              onCheckedChange={(checked) => handleSettingChange('preventDuplicateApplications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pause-failures">Pause on Consecutive Failures</Label>
              <p className="text-sm text-muted-foreground">
                Automatically pause automation after {settings.consecutiveFailureThreshold} consecutive failures
              </p>
            </div>
            <Switch
              id="pause-failures"
              checked={settings.pauseOnConsecutiveFailures}
              onCheckedChange={(checked) => handleSettingChange('pauseOnConsecutiveFailures', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Company Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Company Filters</CardTitle>
          <CardDescription>
            Control which companies your automation can apply to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="company-blacklist">Company Blacklist</Label>
              <p className="text-sm text-muted-foreground">
                Never apply to jobs from specific companies
              </p>
            </div>
            <Switch
              id="company-blacklist"
              checked={settings.enableCompanyBlacklist}
              onCheckedChange={(checked) => handleSettingChange('enableCompanyBlacklist', checked)}
            />
          </div>

          {settings.enableCompanyBlacklist && (
            <div className="space-y-2">
              <Label htmlFor="blacklist-companies">Blocked Companies (one per line)</Label>
              <Textarea
                id="blacklist-companies"
                placeholder="e.g.&#10;Company A&#10;Company B&#10;Company C"
                value={settings.companyBlacklist.join('\n')}
                onChange={(e) => handleSettingChange('companyBlacklist', e.target.value.split('\n').filter(Boolean))}
                rows={4}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyword Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Keyword Filters</CardTitle>
          <CardDescription>
            Filter jobs based on job description keywords
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="keyword-blacklist">Keyword Blacklist</Label>
              <p className="text-sm text-muted-foreground">
                Skip jobs containing specific keywords
              </p>
            </div>
            <Switch
              id="keyword-blacklist"
              checked={settings.enableKeywordBlacklist}
              onCheckedChange={(checked) => handleSettingChange('enableKeywordBlacklist', checked)}
            />
          </div>

          {settings.enableKeywordBlacklist && (
            <div className="space-y-2">
              <Label htmlFor="blacklist-keywords">Blocked Keywords (comma-separated)</Label>
              <Textarea
                id="blacklist-keywords"
                placeholder="e.g. unpaid, internship, volunteer, commission only"
                value={settings.keywordBlacklist.join(', ')}
                onChange={(e) => handleSettingChange('keywordBlacklist', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                rows={3}
              />
            </div>
          )}
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