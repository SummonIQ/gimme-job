'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Bot,
  Settings,
  Play,
  Pause,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter,
  Eye,
  BarChart,
  Calendar,
  Layers,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

// Import existing components
import { AutomationAnalyticsDashboard } from './automation-analytics-dashboard';
import { AutomationSchedulingDashboard } from './automation-scheduling-dashboard';
import { AutomationStatusPanel } from './automation-status-panel';
import { AutomationHistory } from './automation-history';
import { MultiPlatformDashboard } from './multi-platform-dashboard';
import { ErrorMonitoringDashboard } from './error-monitoring-dashboard';

interface SystemStatus {
  isRunning: boolean;
  totalScheduled: number;
  totalCompleted: number;
  successRate: number;
  lastActivity: string | null;
  errors: number;
  platformsActive: string[];
}

export function ComprehensiveAutomationDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchSystemStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/automation/status');
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAutomation = async () => {
    try {
      const response = await fetch('/api/automation/control/start', {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Automation started successfully');
        fetchSystemStatus();
      } else {
        toast.error('Failed to start automation');
      }
    } catch (error) {
      toast.error('Error starting automation');
    }
  };

  const handlePauseAutomation = async () => {
    try {
      const response = await fetch('/api/automation/control/pause', {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Automation paused successfully');
        fetchSystemStatus();
      } else {
        toast.error('Failed to pause automation');
      }
    } catch (error) {
      toast.error('Error pausing automation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Overview Header */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      systemStatus?.isRunning ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <p className="text-lg font-semibold">
                    {systemStatus?.isRunning ? 'Running' : 'Stopped'}
                  </p>
                </div>
              </div>
              <Bot className={`h-8 w-8 ${
                systemStatus?.isRunning ? 'text-green-500' : 'text-gray-400'
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  {systemStatus?.successRate?.toFixed(1) || 0}%
                  {(systemStatus?.successRate || 0) > 80 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold">{systemStatus?.totalScheduled || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platforms Active</p>
                <p className="text-2xl font-bold">{systemStatus?.platformsActive?.length || 0}</p>
              </div>
              <Layers className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Control Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {!systemStatus?.isRunning ? (
              <Button onClick={handleStartAutomation} className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Start Automation
              </Button>
            ) : (
              <Button
                onClick={handlePauseAutomation}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Pause className="h-4 w-4" />
                Pause Automation
              </Button>
            )}

            <Button variant="outline" onClick={fetchSystemStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Last activity:</span>
              <Badge variant="secondary">
                {systemStatus?.lastActivity ?
                  new Date(systemStatus.lastActivity).toLocaleTimeString() :
                  'None'
                }
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Alerts */}
      {systemStatus && systemStatus.errors > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>System Alerts</AlertTitle>
          <AlertDescription>
            {systemStatus.errors} error(s) detected. Check the Error Monitoring tab for details.
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduling
          </TabsTrigger>
          <TabsTrigger value="platforms" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Platforms
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Errors
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle>Current Status</CardTitle>
              </CardHeader>
              <CardContent>
                <AutomationStatusPanel />
              </CardContent>
            </Card>

            {/* Recent Activity Preview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest automated applications</CardDescription>
              </CardHeader>
              <CardContent>
                <AutomationHistory limit={5} />
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Completed</p>
                    <p className="text-2xl font-bold">{systemStatus?.totalCompleted || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Platforms</p>
                    <div className="flex gap-1 mt-2">
                      {systemStatus?.platformsActive?.map((platform) => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Layers className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Error Rate</p>
                    <p className="text-2xl font-bold">
                      {systemStatus && systemStatus.totalCompleted > 0
                        ? ((systemStatus.errors / systemStatus.totalCompleted) * 100).toFixed(1)
                        : 0
                      }%
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Queue Length</p>
                    <p className="text-2xl font-bold">{systemStatus?.totalScheduled || 0}</p>
                  </div>
                  <Filter className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <AutomationAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="scheduling">
          <AutomationSchedulingDashboard />
        </TabsContent>

        <TabsContent value="platforms">
          <MultiPlatformDashboard />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorMonitoringDashboard />
        </TabsContent>

        <TabsContent value="history">
          <AutomationHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}