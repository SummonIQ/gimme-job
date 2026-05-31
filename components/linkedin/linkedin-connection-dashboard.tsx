'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const LinkedInConnectionStatus = {
  ACCEPTED: 'ACCEPTED',
  ERROR: 'ERROR',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

type LinkedInConnectionStatus =
  (typeof LinkedInConnectionStatus)[keyof typeof LinkedInConnectionStatus];

const LinkedInTemplateType = {
  CONNECTION_REQUEST: 'CONNECTION_REQUEST',
  FOLLOW_UP: 'FOLLOW_UP',
  JOB_INQUIRY: 'JOB_INQUIRY',
  NETWORKING: 'NETWORKING',
} as const;

type LinkedInTemplateType =
  (typeof LinkedInTemplateType)[keyof typeof LinkedInTemplateType];

interface ConnectionData {
  id: string;
  targetProfileId: string;
  targetName: string;
  targetHeadline: string;
  targetCompany: string;
  status: LinkedInConnectionStatus;
  templateUsed?: string;
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  messageContent?: string;
  followUpScheduled?: boolean;
  automationEnabled: boolean;
}

interface ConnectionAnalytics {
  overview: {
    totalConnections: number;
    pendingConnections: number;
    acceptedConnections: number;
    rejectedConnections: number;
    acceptanceRate: number;
    avgResponseTime: number;
  };
  trends: {
    dailyStats: Array<{
      date: string;
      sent: number;
      accepted: number;
      rejected: number;
    }>;
  };
  templates: Array<{
    id: string;
    name: string;
    usageCount: number;
    successRate: number;
  }>;
}

interface MessageTemplate {
  id: string;
  name: string;
  description?: string;
  message: string;
  templateType: LinkedInTemplateType;
  useCase?: string;
  isActive: boolean;
  isDefault: boolean;
  usageCount: number;
  successRate: number;
}

export function LinkedInConnectionDashboard() {
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [analytics, setAnalytics] = useState<ConnectionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [todaysSent, setTodaysSent] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Dialog states
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null);

  // New connection form
  const [newConnectionData, setNewConnectionData] = useState({
    targetProfileUrl: '',
    templateId: '',
    customMessage: '',
    scheduleFor: '',
  });

  // New template form
  const [newTemplateData, setNewTemplateData] = useState<{
    description: string;
    isActive: boolean;
    isDefault: boolean;
    message: string;
    name: string;
    templateType: LinkedInTemplateType;
    useCase: string;
  }>({
    name: '',
    description: '',
    message: '',
    templateType: LinkedInTemplateType.CONNECTION_REQUEST,
    useCase: '',
    isActive: true,
    isDefault: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load connections, templates, and analytics
      const [connectionsRes, templatesRes, analyticsRes] = await Promise.all([
        fetch('/api/linkedin/connections'),
        fetch('/api/linkedin/templates'),
        fetch('/api/linkedin/analytics/connections'),
      ]);

      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json();
        setConnections(connectionsData);
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }

      // Load automation settings
      const settingsRes = await fetch('/api/linkedin/automation/settings');
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setIsAutomationEnabled(settings.connectionAutomationEnabled);
        setDailyLimit(settings.dailyConnectionLimit);
        setTodaysSent(settings.todaysSent);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load connection data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendConnection = async () => {
    try {
      const response = await fetch('/api/linkedin/connections/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConnectionData),
      });

      if (response.ok) {
        toast.success('Connection request sent successfully');
        setShowNewConnection(false);
        setNewConnectionData({
          targetProfileUrl: '',
          templateId: '',
          customMessage: '',
          scheduleFor: '',
        });
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send connection request');
      }
    } catch (error) {
      console.error('Error sending connection:', error);
      toast.error('Failed to send connection request');
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const response = await fetch('/api/linkedin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplateData),
      });

      if (response.ok) {
        toast.success('Template created successfully');
        setShowTemplateManager(false);
        setNewTemplateData({
          name: '',
          description: '',
          message: '',
          templateType: LinkedInTemplateType.CONNECTION_REQUEST,
          useCase: '',
          isActive: true,
          isDefault: false,
        });
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create template');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    }
  };

  const toggleAutomation = async () => {
    try {
      const response = await fetch('/api/linkedin/automation/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionAutomationEnabled: !isAutomationEnabled,
        }),
      });

      if (response.ok) {
        setIsAutomationEnabled(!isAutomationEnabled);
        toast.success(
          `Automation ${!isAutomationEnabled ? 'enabled' : 'disabled'}`,
        );
      } else {
        toast.error('Failed to update automation settings');
      }
    } catch (error) {
      console.error('Error toggling automation:', error);
      toast.error('Failed to update automation settings');
    }
  };

  const filteredConnections = connections.filter(conn => {
    if (statusFilter !== 'all' && conn.status !== statusFilter) return false;
    if (
      searchFilter &&
      !conn.targetName.toLowerCase().includes(searchFilter.toLowerCase()) &&
      !conn.targetCompany.toLowerCase().includes(searchFilter.toLowerCase())
    )
      return false;
    // Add date filtering logic here
    return true;
  });

  const getStatusColor = (status: LinkedInConnectionStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'WITHDRAWN':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            LinkedIn Connections
          </h2>
          <p className="text-muted-foreground">
            Manage your LinkedIn connection outreach and automation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Modal open={showNewConnection} onOpenChange={setShowNewConnection}>
            <ModalTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Connection
              </Button>
            </ModalTrigger>
          </Modal>
        </div>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Connections
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.overview.totalConnections}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.overview.pendingConnections}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.overview.acceptedConnections}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Acceptance Rate
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.overview.acceptanceRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Daily Progress
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todaysSent}/{dailyLimit}
              </div>
              <Progress
                value={(todaysSent / dailyLimit) * 100}
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Automation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Automation Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Connection Automation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send connection requests using your templates
              </p>
            </div>
            <Switch
              checked={isAutomationEnabled}
              onCheckedChange={toggleAutomation}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="dailyLimit">Daily Connection Limit</Label>
              <Input
                id="dailyLimit"
                type="number"
                value={dailyLimit}
                onChange={e => setDailyLimit(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label>Status</Label>
              <div className="flex items-center gap-2 mt-1">
                {isAutomationEnabled ? (
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Pause className="h-3 w-3 mr-1" />
                    Paused
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="templates">Message Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search connections..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Connections List */}
          <div className="space-y-4">
            {filteredConnections.map(connection => (
              <Card key={connection.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="space-y-1">
                        <h4 className="font-semibold">
                          {connection.targetName}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {connection.targetHeadline} at{' '}
                          {connection.targetCompany}
                        </p>
                        {connection.sentAt && (
                          <p className="text-xs text-muted-foreground">
                            Sent{' '}
                            {new Date(connection.sentAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(connection.status)}>
                        {connection.status.toLowerCase()}
                      </Badge>
                      {connection.templateUsed && (
                        <Badge variant="outline">
                          {templates.find(t => t.id === connection.templateUsed)
                            ?.name || 'Template'}
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Message Templates</h3>
            <Modal
              open={showTemplateManager}
              onOpenChange={setShowTemplateManager}
            >
              <ModalTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </ModalTrigger>
            </Modal>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {templates.map(template => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {template.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      {!template.isActive && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  {template.description && (
                    <CardDescription>{template.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {template.message}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span>Used {template.usageCount} times</span>
                      <span>
                        {template.successRate.toFixed(1)}% success rate
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Connection Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Chart showing daily connection activity will be displayed here
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Template Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.templates.map(template => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{template.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {template.usageCount} uses
                        </span>
                        <Badge variant="outline">
                          {template.successRate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Connection Dialog */}
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Send Connection Request</ModalTitle>
          <ModalDescription>
            Send a personalized connection request to a LinkedIn profile
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="profileUrl">LinkedIn Profile URL</Label>
            <Input
              id="profileUrl"
              placeholder="https://www.linkedin.com/in/username"
              value={newConnectionData.targetProfileUrl}
              onChange={e =>
                setNewConnectionData(prev => ({
                  ...prev,
                  targetProfileUrl: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="template">Message Template</Label>
            <Select
              value={newConnectionData.templateId}
              onValueChange={value =>
                setNewConnectionData(prev => ({
                  ...prev,
                  templateId: value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates
                  .filter(t => t.isActive)
                  .map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="customMessage">Custom Message (Optional)</Label>
            <Textarea
              id="customMessage"
              placeholder="Override the template with a custom message..."
              value={newConnectionData.customMessage}
              onChange={e =>
                setNewConnectionData(prev => ({
                  ...prev,
                  customMessage: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewConnection(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSendConnection}>Send Connection</Button>
          </div>
        </div>
      </ModalContent>

      {/* Template Manager Dialog */}
      <Modal open={showTemplateManager} onOpenChange={setShowTemplateManager}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Create Message Template</ModalTitle>
            <ModalDescription>
              Create a reusable template for LinkedIn connection requests
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  placeholder="e.g., General Networking"
                  value={newTemplateData.name}
                  onChange={e =>
                    setNewTemplateData(prev => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="templateType">Type</Label>
                <Select
                  value={newTemplateData.templateType}
                  onValueChange={(value: LinkedInTemplateType) =>
                    setNewTemplateData(prev => ({
                      ...prev,
                      templateType: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LinkedInTemplateType.CONNECTION_REQUEST}>
                      Connection Request
                    </SelectItem>
                    <SelectItem value={LinkedInTemplateType.FOLLOW_UP}>
                      Follow Up
                    </SelectItem>
                    <SelectItem value={LinkedInTemplateType.JOB_INQUIRY}>
                      Job Inquiry
                    </SelectItem>
                    <SelectItem value={LinkedInTemplateType.NETWORKING}>
                      Networking
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="templateDescription">Description</Label>
              <Input
                id="templateDescription"
                placeholder="Brief description of when to use this template"
                value={newTemplateData.description}
                onChange={e =>
                  setNewTemplateData(prev => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="templateMessage">Message</Label>
              <Textarea
                id="templateMessage"
                placeholder="Hi {firstName}, I'd love to connect..."
                value={newTemplateData.message}
                onChange={e =>
                  setNewTemplateData(prev => ({
                    ...prev,
                    message: e.target.value,
                  }))
                }
                className="min-h-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variables like {'{firstName}'}, {'{company}'},{' '}
                {'{headline}'} for personalization
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={newTemplateData.isActive}
                  onCheckedChange={checked =>
                    setNewTemplateData(prev => ({
                      ...prev,
                      isActive: checked,
                    }))
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={newTemplateData.isDefault}
                  onCheckedChange={checked =>
                    setNewTemplateData(prev => ({
                      ...prev,
                      isDefault: checked,
                    }))
                  }
                />
                <Label htmlFor="isDefault">Set as Default</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTemplateManager(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTemplate}>Create Template</Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
