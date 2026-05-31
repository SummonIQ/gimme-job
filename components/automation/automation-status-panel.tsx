"use client";

import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square,
  CheckCircle, 
  XCircle,
  Clock,
  AlertCircle,
  Bot
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

interface AutomationStatus {
  isActive: boolean;
  totalRules: number;
  activeRules: number;
  applicationsToday: number;
  dailyLimit: number;
  applicationsThisHour: number;
  hourlyLimit: number;
  nextAvailableTime?: Date;
  lastActivity?: Date;
  currentJob?: {
    title: string;
    company: string;
    status: 'processing' | 'awaiting_approval' | 'submitting';
  };
}

export function AutomationStatusPanel() {
  const [status, setStatus] = useState<AutomationStatus>({
    isActive: false,
    totalRules: 0,
    activeRules: 0,
    applicationsToday: 0,
    dailyLimit: 50,
    applicationsThisHour: 0,
    hourlyLimit: 10,
  });

  useEffect(() => {
    // TODO: Fetch real automation status from API
    // For now, using mock data
    setStatus({
      isActive: false,
      totalRules: 1,
      activeRules: 0,
      applicationsToday: 0,
      dailyLimit: 50,
      applicationsThisHour: 0,
      hourlyLimit: 10,
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });
  }, []);

  const handleStartAutomation = () => {
    // TODO: Implement start automation API call
    setStatus(prev => ({ ...prev, isActive: true }));
  };

  const handlePauseAutomation = () => {
    // TODO: Implement pause automation API call
    setStatus(prev => ({ ...prev, isActive: false }));
  };

  const handleStopAutomation = () => {
    // TODO: Implement stop automation API call
    setStatus(prev => ({ 
      ...prev, 
      isActive: false,
      currentJob: undefined 
    }));
  };

  const getStatusBadge = () => {
    if (status.isActive) {
      return <Badge className="bg-green-500">Active</Badge>;
    }
    if (status.activeRules > 0) {
      return <Badge variant="secondary">Paused</Badge>;
    }
    return <Badge variant="outline">Inactive</Badge>;
  };

  const getStatusIcon = () => {
    if (status.isActive) {
      return <Bot className="h-5 w-5 text-green-500 animate-pulse" />;
    }
    return <Bot className="h-5 w-5 text-muted-foreground" />;
  };

  const dailyProgress = (status.applicationsToday / status.dailyLimit) * 100;
  const hourlyProgress = (status.applicationsThisHour / status.hourlyLimit) * 100;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">Automation</span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Current Activity */}
      {status.currentJob && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Currently Processing</h4>
            <div className="bg-muted rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">{status.currentJob.title}</p>
              <p className="text-xs text-muted-foreground">{status.currentJob.company}</p>
              <div className="flex items-center gap-2">
                {status.currentJob.status === 'processing' && (
                  <>
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">Processing application...</span>
                  </>
                )}
                {status.currentJob.status === 'awaiting_approval' && (
                  <>
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs">Awaiting your approval</span>
                  </>
                )}
                {status.currentJob.status === 'submitting' && (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs">Submitting application...</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rate Limit Status */}
      <Separator />
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Rate Limits</h4>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Today ({status.applicationsToday}/{status.dailyLimit})</span>
            <span>{Math.round(dailyProgress)}%</span>
          </div>
          <Progress value={dailyProgress} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>This Hour ({status.applicationsThisHour}/{status.hourlyLimit})</span>
            <span>{Math.round(hourlyProgress)}%</span>
          </div>
          <Progress value={hourlyProgress} className="h-2" />
        </div>
      </div>

      {/* Rules Status */}
      <Separator />
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Active Rules</h4>
        <div className="flex justify-between text-sm">
          <span>Total Rules:</span>
          <span>{status.totalRules}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Active Rules:</span>
          <span className="text-green-600">{status.activeRules}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Paused Rules:</span>
          <span className="text-yellow-600">{status.totalRules - status.activeRules}</span>
        </div>
      </div>

      {/* Last Activity */}
      {status.lastActivity && (
        <>
          <Separator />
          <div className="text-xs text-muted-foreground">
            Last activity: {status.lastActivity.toLocaleString()}
          </div>
        </>
      )}

      {/* Next Available Time */}
      {status.nextAvailableTime && (
        <div className="text-xs text-muted-foreground">
          Next application available: {status.nextAvailableTime.toLocaleString()}
        </div>
      )}

      {/* Control Buttons */}
      <Separator />
      <div className="space-y-2">
        {!status.isActive ? (
          <Button 
            onClick={handleStartAutomation}
            disabled={status.activeRules === 0}
            className="w-full"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Automation
          </Button>
        ) : (
          <div className="space-y-2">
            <Button 
              onClick={handlePauseAutomation}
              variant="secondary"
              className="w-full"
              size="sm"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause Automation
            </Button>
            <Button 
              onClick={handleStopAutomation}
              variant="destructive"
              className="w-full"
              size="sm"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop All
            </Button>
          </div>
        )}
      </div>

      {status.activeRules === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            Create an automation rule to start applying to jobs automatically.
          </p>
        </div>
      )}
    </div>
  );
}