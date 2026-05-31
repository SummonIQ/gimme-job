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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/css/index';
import { format } from 'date-fns';
import {
  AlertCircle,
  Clock,
  Edit,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  format: 'csv' | 'excel' | 'pdf';
  dataType:
    | 'applications'
    | 'job-searches'
    | 'resumes'
    | 'interviews'
    | 'combined';
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetails: boolean;
  emailRecipients: string[];
  isActive: boolean;
  nextRun?: Date;
  lastRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ScheduledReportsManagerProps {
  className?: string;
}

const frequencyLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const formatIcons = {
  csv: FileText,
  excel: FileSpreadsheet,
  pdf: FileImage,
};

const dataTypeLabels = {
  applications: 'Applications',
  'job-searches': 'Job Searches',
  resumes: 'Resumes',
  interviews: 'Interviews',
  combined: 'Combined Report',
};

export function ScheduledReportsManager({
  className,
}: ScheduledReportsManagerProps) {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'weekly' as const,
    format: 'excel' as const,
    dataType: 'applications' as const,
    includeCharts: true,
    includeSummary: true,
    includeDetails: true,
    emailRecipients: [''],
    isActive: true,
  });

  // Load scheduled reports
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/exports/scheduled');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      } else {
        toast.error('Failed to load scheduled reports');
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load scheduled reports');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      frequency: 'weekly',
      format: 'excel',
      dataType: 'applications',
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      emailRecipients: [''],
      isActive: true,
    });
    setEditingReport(null);
  };

  const handleCreateReport = async () => {
    if (!formData.name.trim()) {
      toast.error('Report name is required');
      return;
    }

    const emailRecipients = formData.emailRecipients.filter(email =>
      email.trim(),
    );
    if (emailRecipients.length === 0) {
      toast.error('At least one email recipient is required');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/exports/scheduled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          emailRecipients,
        }),
      });

      if (response.ok) {
        toast.success('Scheduled report created successfully');
        setShowCreateDialog(false);
        resetForm();
        loadReports();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create scheduled report');
      }
    } catch (error) {
      console.error('Error creating report:', error);
      toast.error('Failed to create scheduled report');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateReport = async () => {
    if (!editingReport) return;

    const emailRecipients = formData.emailRecipients.filter(email =>
      email.trim(),
    );
    if (emailRecipients.length === 0) {
      toast.error('At least one email recipient is required');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/exports/scheduled', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingReport.id,
          ...formData,
          emailRecipients,
        }),
      });

      if (response.ok) {
        toast.success('Scheduled report updated successfully');
        setShowCreateDialog(false);
        resetForm();
        loadReports();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update scheduled report');
      }
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Failed to update scheduled report');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }

    try {
      const response = await fetch(`/api/exports/scheduled?id=${reportId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Scheduled report deleted successfully');
        loadReports();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete scheduled report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete scheduled report');
    }
  };

  const handleToggleReport = async (reportId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/exports/scheduled', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: reportId,
          isActive,
        }),
      });

      if (response.ok) {
        toast.success(
          `Report ${isActive ? 'activated' : 'paused'} successfully`,
        );
        loadReports();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update report status');
      }
    } catch (error) {
      console.error('Error toggling report:', error);
      toast.error('Failed to update report status');
    }
  };

  const handleEditReport = (report: ScheduledReport) => {
    setFormData({
      name: report.name,
      description: report.description || '',
      frequency: report.frequency,
      format: report.format,
      dataType: report.dataType,
      includeCharts: report.includeCharts,
      includeSummary: report.includeSummary,
      includeDetails: report.includeDetails,
      emailRecipients: report.emailRecipients,
      isActive: report.isActive,
    });
    setEditingReport(report);
    setShowCreateDialog(true);
  };

  const addEmailRecipient = () => {
    setFormData(prev => ({
      ...prev,
      emailRecipients: [...prev.emailRecipients, ''],
    }));
  };

  const updateEmailRecipient = (index: number, email: string) => {
    setFormData(prev => ({
      ...prev,
      emailRecipients: prev.emailRecipients.map((e, i) =>
        i === index ? email : e,
      ),
    }));
  };

  const removeEmailRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      emailRecipients: prev.emailRecipients.filter((_, i) => i !== index),
    }));
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Scheduled Reports
            </CardTitle>
            <CardDescription>
              Automatically generate and email reports on a regular schedule
            </CardDescription>
          </div>
          <Modal open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <ModalTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Schedule
              </Button>
            </ModalTrigger>
            <ModalContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <ModalHeader>
                <ModalTitle>
                  {editingReport
                    ? 'Edit Scheduled Report'
                    : 'Create Scheduled Report'}
                </ModalTitle>
                <ModalDescription>
                  Set up automatic report generation and email delivery
                </ModalDescription>
              </ModalHeader>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reportName">Report Name</Label>
                    <Input
                      id="reportName"
                      placeholder="e.g., Weekly Application Summary"
                      value={formData.name}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of this report"
                      value={formData.description}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                {/* Report Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Frequency</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value: any) =>
                        setFormData(prev => ({ ...prev, frequency: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Format</Label>
                    <Select
                      value={formData.format}
                      onValueChange={(value: any) =>
                        setFormData(prev => ({ ...prev, format: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label>Data Type</Label>
                    <Select
                      value={formData.dataType}
                      onValueChange={(value: any) =>
                        setFormData(prev => ({ ...prev, dataType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="applications">
                          Job Applications
                        </SelectItem>
                        <SelectItem value="job-searches">
                          Job Searches
                        </SelectItem>
                        <SelectItem value="resumes">Resumes</SelectItem>
                        <SelectItem value="interviews">Interviews</SelectItem>
                        <SelectItem value="combined">
                          Combined Report
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Include Options */}
                <div className="space-y-3">
                  <Label>Include Options</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Summary Statistics</div>
                        <div className="text-sm text-muted-foreground">
                          Include overview metrics
                        </div>
                      </div>
                      <Switch
                        checked={formData.includeSummary}
                        onCheckedChange={checked =>
                          setFormData(prev => ({
                            ...prev,
                            includeSummary: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Detailed Data</div>
                        <div className="text-sm text-muted-foreground">
                          Include individual records
                        </div>
                      </div>
                      <Switch
                        checked={formData.includeDetails}
                        onCheckedChange={checked =>
                          setFormData(prev => ({
                            ...prev,
                            includeDetails: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          Charts & Visualizations
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Include charts (PDF/Excel only)
                        </div>
                      </div>
                      <Switch
                        checked={formData.includeCharts}
                        onCheckedChange={checked =>
                          setFormData(prev => ({
                            ...prev,
                            includeCharts: checked,
                          }))
                        }
                        disabled={formData.format === 'csv'}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Email Recipients */}
                <div className="space-y-3">
                  <Label>Email Recipients</Label>
                  {formData.emailRecipients.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="email@example.com"
                        value={email}
                        onChange={e =>
                          updateEmailRecipient(index, e.target.value)
                        }
                      />
                      {formData.emailRecipients.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeEmailRecipient(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addEmailRecipient}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Email
                  </Button>
                </div>

                <Separator />

                {/* Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Active</div>
                    <div className="text-sm text-muted-foreground">
                      Enable automatic report generation
                    </div>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={checked =>
                      setFormData(prev => ({ ...prev, isActive: checked }))
                    }
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={
                      editingReport ? handleUpdateReport : handleCreateReport
                    }
                    disabled={isCreating}
                  >
                    {isCreating && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingReport ? 'Update' : 'Create'} Report
                  </Button>
                </div>
              </div>
            </ModalContent>
          </Modal>
        </div>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scheduled Reports</h3>
            <p className="text-muted-foreground mb-4">
              Create your first scheduled report to automatically receive
              analytics data
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => {
              const FormatIcon = formatIcons[report.format];
              return (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{report.name}</h3>
                      <Badge
                        variant={report.isActive ? 'default' : 'secondary'}
                      >
                        {report.isActive ? 'Active' : 'Paused'}
                      </Badge>
                      <Badge variant="outline">
                        {frequencyLabels[report.frequency]}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <FormatIcon className="h-4 w-4" />
                        <span className="text-sm">
                          {report.format.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {report.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {report.description}
                      </p>
                    )}

                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Data:</span>{' '}
                      {dataTypeLabels[report.dataType]} •
                      <span className="font-medium ml-1">Recipients:</span>{' '}
                      {report.emailRecipients.length} •
                      {report.nextRun && (
                        <>
                          <span className="font-medium ml-1">Next run:</span>{' '}
                          {format(
                            new Date(report.nextRun),
                            'MMM dd, yyyy HH:mm',
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleToggleReport(report.id, !report.isActive)
                      }
                    >
                      {report.isActive ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditReport(report)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteReport(report.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
