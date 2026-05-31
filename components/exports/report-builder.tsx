'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Download, 
  FileText, 
  Filter, 
  Calendar, 
  Settings,
  Loader2,
  FileSpreadsheet,
  FileImage,
  FileJson,
  X
} from 'lucide-react';
import { cn } from '@/lib/css/index';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface ReportBuilderProps {
  onExport?: (reportData: any) => void;
  className?: string;
}

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';
export type DataType = 'applications' | 'job-searches' | 'resumes' | 'interviews' | 'combined';

interface ReportConfig {
  name: string;
  format: ExportFormat;
  dataType: DataType;
  dateRange?: DateRange;
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetails: boolean;
  customFields: string[];
  filters: Record<string, any>;
}

const dataTypeOptions = [
  { value: 'applications', label: 'Job Applications', description: 'All job application data and status tracking' },
  { value: 'job-searches', label: 'Job Searches', description: 'Search queries, results, and effectiveness metrics' },
  { value: 'resumes', label: 'Resumes', description: 'Resume versions, scores, and performance analytics' },
  { value: 'interviews', label: 'Interviews', description: 'Interview schedules, outcomes, and feedback' },
  { value: 'combined', label: 'Complete Report', description: 'All data types in comprehensive format' }
];

const formatOptions = [
  { value: 'csv', label: 'CSV', description: 'Comma-separated values for spreadsheet applications', icon: FileText },
  { value: 'excel', label: 'Excel', description: 'Rich formatted spreadsheet with multiple sheets', icon: FileSpreadsheet },
  { value: 'json', label: 'JSON', description: 'Structured data for API integrations', icon: FileJson },
  { value: 'pdf', label: 'PDF', description: 'Professional report with charts and formatting', icon: FileImage }
];

const fieldOptions = {
  applications: [
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'company', label: 'Company Name' },
    { id: 'jobProvider', label: 'Job Provider' },
    { id: 'status', label: 'Application Status' },
    { id: 'appliedDate', label: 'Application Date' },
    { id: 'resumeName', label: 'Resume Used' },
    { id: 'firstResponseDate', label: 'First Response Date' },
    { id: 'firstInterviewDate', label: 'Interview Date' },
    { id: 'offerDate', label: 'Offer Date' },
    { id: 'salary', label: 'Salary Information' },
    { id: 'location', label: 'Job Location' },
    { id: 'notes', label: 'Application Notes' }
  ],
  'job-searches': [
    { id: 'query', label: 'Search Query' },
    { id: 'location', label: 'Search Location' },
    { id: 'status', label: 'Search Status' },
    { id: 'createdDate', label: 'Search Date' },
    { id: 'resultsCount', label: 'Results Found' },
    { id: 'applicationsCount', label: 'Applications Made' }
  ],
  resumes: [
    { id: 'name', label: 'Resume Name' },
    { id: 'createdDate', label: 'Created Date' },
    { id: 'revisionsCount', label: 'Number of Revisions' },
    { id: 'applicationsCount', label: 'Applications Count' },
    { id: 'latestScore', label: 'Latest Optimization Score' },
    { id: 'isActive', label: 'Currently Active' }
  ],
  interviews: [
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'company', label: 'Company Name' },
    { id: 'interviewDate', label: 'Interview Date' },
    { id: 'status', label: 'Interview Status' },
    { id: 'offerDate', label: 'Offer Date' },
    { id: 'salary', label: 'Salary Offered' }
  ],
  combined: [
    { id: 'all', label: 'All Available Fields' }
  ]
};

export function ReportBuilder({ onExport, className }: ReportBuilderProps) {
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    format: 'excel',
    dataType: 'applications',
    includeCharts: true,
    includeSummary: true,
    includeDetails: true,
    customFields: [],
    filters: {}
  });

  const [isExporting, setIsExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('basic');

  // Update selected fields when data type changes
  useEffect(() => {
    const defaultFields = fieldOptions[config.dataType]?.map(field => field.id) || [];
    setSelectedFields(defaultFields);
    setConfig(prev => ({ ...prev, customFields: defaultFields }));
  }, [config.dataType]);

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    const updatedFields = checked 
      ? [...selectedFields, fieldId]
      : selectedFields.filter(id => id !== fieldId);
    
    setSelectedFields(updatedFields);
    setConfig(prev => ({ ...prev, customFields: updatedFields }));
  };

  const handleFilterChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value
      }
    }));
  };

  const removeFilter = (key: string) => {
    const newFilters = { ...config.filters };
    delete newFilters[key];
    setConfig(prev => ({ ...prev, filters: newFilters }));
  };

  const handleExport = async () => {
    if (!config.name.trim()) {
      toast.error('Please enter a report name');
      return;
    }

    setIsExporting(true);
    
    try {
      const exportData = {
        ...config,
        dateRange: config.dateRange ? {
          start: config.dateRange.from?.toISOString(),
          end: config.dateRange.to?.toISOString()
        } : undefined
      };

      const response = await fetch('/api/exports/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 
                   `${config.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.${config.format === 'excel' ? 'xlsx' : config.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Report exported successfully!');
      
      if (onExport) {
        onExport(exportData);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    const option = formatOptions.find(opt => opt.value === format);
    const Icon = option?.icon || FileText;
    return Icon;
  };

  return (
    <Card className={cn('w-full max-w-4xl', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Custom Report Builder
        </CardTitle>
        <CardDescription>
          Create and export custom reports with your job search data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="data">Data Selection</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="preview">Preview & Export</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="reportName">Report Name</Label>
                <Input
                  id="reportName"
                  placeholder="e.g., Q1 Application Summary"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <Label>Date Range</Label>
                <div className="mt-2">
                  <DatePickerWithRange
                    date={config.dateRange}
                    onDateChange={(date) => setConfig(prev => ({ ...prev, dateRange: date }))}
                    placeholder="Select date range (optional)"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Leave empty to include all available data
                </p>
              </div>

              <div>
                <Label>Data Type</Label>
                <Select value={config.dataType} onValueChange={(value: DataType) => setConfig(prev => ({ ...prev, dataType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dataTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Export Format</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {formatOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <div
                        key={option.value}
                        className={cn(
                          'p-4 border rounded-lg cursor-pointer transition-colors',
                          config.format === option.value 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => setConfig(prev => ({ ...prev, format: option.value as ExportFormat }))}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5" />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-muted-foreground">{option.description}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Include Options</Label>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Summary Statistics</div>
                      <div className="text-sm text-muted-foreground">Include overview metrics and key insights</div>
                    </div>
                    <Switch
                      checked={config.includeSummary}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, includeSummary: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Detailed Data</div>
                      <div className="text-sm text-muted-foreground">Include individual records and full details</div>
                    </div>
                    <Switch
                      checked={config.includeDetails}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, includeDetails: checked }))}
                    />
                  </div>
                  {(config.format === 'pdf' || config.format === 'excel') && (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Charts & Visualizations</div>
                        <div className="text-sm text-muted-foreground">Include charts and graphs in the export</div>
                      </div>
                      <Switch
                        checked={config.includeCharts}
                        onCheckedChange={(checked) => setConfig(prev => ({ ...prev, includeCharts: checked }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <Label>Custom Fields</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select which fields to include in your export
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fieldOptions[config.dataType]?.map(field => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.id}
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={(checked) => handleFieldToggle(field.id, !!checked)}
                      />
                      <Label htmlFor={field.id} className="text-sm font-normal">
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="filters" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Add Filters</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Filter your data to include only specific records
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {config.dataType === 'applications' && (
                    <>
                      <div>
                        <Label htmlFor="statusFilter">Application Status</Label>
                        <Select
                          value={config.filters.status || ''}
                          onValueChange={(value) => handleFilterChange('status', value || undefined)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All statuses</SelectItem>
                            <SelectItem value="SUBMITTED">Submitted</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="INTERVIEWING">Interviewing</SelectItem>
                            <SelectItem value="OFFERED">Offered</SelectItem>
                            <SelectItem value="ACCEPTED">Accepted</SelectItem>
                            <SelectItem value="REJECTED">Rejected</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="jobProviderFilter">Job Provider</Label>
                        <Select
                          value={config.filters.jobProvider || ''}
                          onValueChange={(value) => handleFilterChange('jobProvider', value || undefined)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All job providers" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All job providers</SelectItem>
                            <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                            <SelectItem value="INDEED">Indeed</SelectItem>
                            <SelectItem value="GLASSDOOR">Glassdoor</SelectItem>
                            <SelectItem value="COMPANY_WEBSITE">Company Website</SelectItem>
                            <SelectItem value="ZIPRECRUITER">ZipRecruiter</SelectItem>
                            <SelectItem value="ANGELLIST">AngelList</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {Object.keys(config.filters).length > 0 && (
                  <div className="mt-4">
                    <Label>Active Filters</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(config.filters).map(([key, value]) => (
                        value && (
                          <Badge key={key} variant="secondary" className="flex items-center gap-1">
                            {key}: {value}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeFilter(key)}
                            />
                          </Badge>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/20">
                <h3 className="font-semibold mb-3">Report Configuration Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Report Name:</div>
                    <div className="text-muted-foreground">{config.name || 'Untitled Report'}</div>
                  </div>
                  <div>
                    <div className="font-medium">Format:</div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      {(() => {
                        const Icon = getFormatIcon(config.format);
                        return <Icon className="h-4 w-4" />;
                      })()}
                      {formatOptions.find(opt => opt.value === config.format)?.label}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Data Type:</div>
                    <div className="text-muted-foreground">
                      {dataTypeOptions.find(opt => opt.value === config.dataType)?.label}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Date Range:</div>
                    <div className="text-muted-foreground">
                      {config.dateRange?.from && config.dateRange?.to
                        ? `${format(config.dateRange.from, 'MMM dd, yyyy')} - ${format(config.dateRange.to, 'MMM dd, yyyy')}`
                        : 'All available data'
                      }
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Selected Fields:</div>
                    <div className="text-muted-foreground">{selectedFields.length} fields</div>
                  </div>
                  <div>
                    <div className="font-medium">Active Filters:</div>
                    <div className="text-muted-foreground">
                      {Object.values(config.filters).filter(Boolean).length} filters
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Ready to export your custom report
                </div>
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting || !config.name.trim()}
                  size="lg"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export Report
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}