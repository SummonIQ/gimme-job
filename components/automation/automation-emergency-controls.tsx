"use client";

import { useState } from 'react';
import { StopCircle, Pause, Play, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface AutomationControlsProps {
  settings: any;
  onSettingsUpdate?: () => void;
}

export function AutomationEmergencyControls({ settings, onSettingsUpdate }: AutomationControlsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleEmergencyStop = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/automation/emergency-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Emergency stop triggered by user',
        }),
      });

      if (!response.ok) throw new Error('Failed to execute emergency stop');

      const data = await response.json();
      
      toast({
        title: "Automation Stopped",
        description: "All automation has been immediately halted.",
        variant: "destructive",
      });

      onSettingsUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop automation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePauseToggle = async () => {
    setLoading(true);
    const newPausedState = !settings?.isPaused;
    
    try {
      const response = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPaused: newPausedState,
          pausedAt: newPausedState ? new Date() : null,
          pauseReason: newPausedState ? 'Paused by user' : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update pause state');

      toast({
        title: newPausedState ? "Automation Paused" : "Automation Resumed",
        description: newPausedState 
          ? "Automation has been paused. No new applications will be submitted."
          : "Automation has been resumed and will continue processing.",
      });

      onSettingsUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update automation state. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableToggle = async () => {
    setLoading(true);
    const newEnabledState = !settings?.isEnabled;
    
    try {
      const response = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: newEnabledState,
          isPaused: false,
          pausedAt: null,
          pauseReason: null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update enabled state');

      toast({
        title: newEnabledState ? "Automation Enabled" : "Automation Disabled",
        description: newEnabledState 
          ? "Automation has been enabled and will start processing applications."
          : "Automation has been disabled.",
      });

      onSettingsUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update automation state. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!settings?.isEnabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    if (settings?.isPaused) {
      return <Badge variant="warning">Paused</Badge>;
    }
    return <Badge variant="success">Active</Badge>;
  };

  const getStatusDescription = () => {
    if (!settings?.isEnabled) {
      return "Automation is currently disabled. Enable it to start processing applications.";
    }
    if (settings?.isPaused) {
      return `Automation is paused. ${settings.pauseReason || 'Resume to continue processing.'}`;
    }
    return "Automation is active and processing applications according to your settings.";
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Automation Status</CardTitle>
              <CardDescription>{getStatusDescription()}</CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {settings?.isEnabled ? (
              <>
                <Button
                  variant={settings?.isPaused ? "default" : "outline"}
                  size="sm"
                  onClick={handlePauseToggle}
                  disabled={loading}
                >
                  {settings?.isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnableToggle}
                  disabled={loading}
                >
                  Disable Automation
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleEnableToggle}
                disabled={loading}
              >
                <Play className="h-4 w-4 mr-2" />
                Enable Automation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Stop */}
      <Alert className="border-destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Emergency Controls</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>Use these controls in case of unexpected behavior or to immediately halt all automation.</p>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={loading}>
                <StopCircle className="h-4 w-4 mr-2" />
                Emergency Stop
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Confirm Emergency Stop
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately stop all automation and cancel any pending applications. 
                  You will need to manually re-enable automation after using emergency stop.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleEmergencyStop}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Execute Emergency Stop
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </AlertDescription>
      </Alert>

      {/* Pause Information */}
      {settings?.isPaused && settings?.pausedAt && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Automation Paused</AlertTitle>
          <AlertDescription>
            <p>Paused at: {new Date(settings.pausedAt).toLocaleString()}</p>
            {settings.pauseReason && <p>Reason: {settings.pauseReason}</p>}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
