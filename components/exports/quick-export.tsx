'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Download, 
  FileText, 
  FileSpreadsheet,
  FileImage,
  FileJson,
  Loader2,
  Calendar,
  BarChart3,
  Users,
  Search
} from 'lucide-react';
import { cn } from '@/lib/css/index';

interface QuickExportProps {
  className?: string;
}

type QuickExportFormat = 'csv' | 'excel' | 'pdf';
type QuickExportType = 'applications-recent' | 'applications-all' | 'analytics-summary' | 'resumes-performance';

interface QuickExportOption {
  id: QuickExportType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  dataType: string;
  defaultFormat: QuickExportFormat;
  availableFormats: QuickExportFormat[];
  includesSummary: boolean;
  includesDetails: boolean;
  dateRange?: 'week' | 'month' | 'quarter' | 'all';
}

const quickExportOptions: QuickExportOption[] = [
  {
    id: 'applications-recent',
    title: 'Recent Applications',
    description: 'Last 30 days of job applications with status tracking',
    icon: Calendar,
    dataType: 'applications',
    defaultFormat: 'excel',
    availableFormats: ['csv', 'excel', 'pdf'],
    includesSummary: true,
    includesDetails: true,
    dateRange: 'month'
  },
  {
    id: 'applications-all',
    title: 'All Applications',
    description: 'Complete history of all job applications',
    icon: FileText,
    dataType: 'applications',
    defaultFormat: 'excel',
    availableFormats: ['csv', 'excel'],
    includesSummary: false,
    includesDetails: true,
    dateRange: 'all'
  },
  {
    id: 'analytics-summary',
    title: 'Analytics Summary',
    description: 'Performance metrics and insights report',
    icon: BarChart3,
    dataType: 'combined',
    defaultFormat: 'pdf',
    availableFormats: ['pdf', 'excel'],
    includesSummary: true,
    includesDetails: false,
    dateRange: 'quarter'
  },
  {
    id: 'resumes-performance',
    title: 'Resume Performance',
    description: 'Resume effectiveness and optimization scores',
    icon: Users,
    dataType: 'resumes',
    defaultFormat: 'excel',
    availableFormats: ['csv', 'excel', 'pdf'],
    includesSummary: true,
    includesDetails: true,
    dateRange: 'all'
  }
];

const formatIcons = {
  csv: FileText,
  excel: FileSpreadsheet,
  pdf: FileImage,
  json: FileJson
};

const formatLabels = {
  csv: 'CSV',
  excel: 'Excel',
  pdf: 'PDF',
  json: 'JSON'
};

export function QuickExport({ className }: QuickExportProps) {
  const [selectedOption, setSelectedOption] = useState<QuickExportOption | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<QuickExportFormat>('excel');
  const [isExporting, setIsExporting] = useState(false);

  const handleOptionSelect = (option: QuickExportOption) => {
    setSelectedOption(option);
    setSelectedFormat(option.defaultFormat);
  };

  const handleExport = async () => {
    if (!selectedOption) return;

    setIsExporting(true);
    
    try {
      // Calculate date range
      let dateRange;
      if (selectedOption.dateRange !== 'all') {
        const end = new Date();
        const start = new Date();
        
        switch (selectedOption.dateRange) {
          case 'week':
            start.setDate(start.getDate() - 7);
            break;
          case 'month':
            start.setDate(start.getDate() - 30);
            break;
          case 'quarter':
            start.setDate(start.getDate() - 90);
            break;
        }
        
        dateRange = { start: start.toISOString(), end: end.toISOString() };
      }

      const response = await fetch('/api/exports/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: selectedFormat,
          dataType: selectedOption.dataType,
          dateRange,
          includeCharts: true,
          includeSummary: selectedOption.includesSummary,
          includeDetails: selectedOption.includesDetails,
          reportName: selectedOption.title
        }),
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
                   `${selectedOption.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.${selectedFormat === 'excel' ? 'xlsx' : selectedFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Report exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Quick Export
        </CardTitle>
        <CardDescription>
          Export commonly used reports with pre-configured settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Report Options */}
        <div>
          <div className="grid grid-cols-1 gap-3">
            {quickExportOptions.map(option => {
              const Icon = option.icon;
              const isSelected = selectedOption?.id === option.id;
              
              return (
                <div
                  key={option.id}
                  className={cn(
                    'p-4 border rounded-lg cursor-pointer transition-colors',
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  )}
                  onClick={() => handleOptionSelect(option)}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium">{option.title}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {option.dataType}
                        </Badge>
                        {option.dateRange && option.dateRange !== 'all' && (
                          <Badge variant="outline" className="text-xs">
                            Last {option.dateRange}
                          </Badge>
                        )}
                        {option.includesSummary && (
                          <Badge variant="outline" className="text-xs">
                            Summary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Format Selection */}
        {selectedOption && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <div>
              <label className="text-sm font-medium">Export Format</label>
              <Select value={selectedFormat} onValueChange={(value: QuickExportFormat) => setSelectedFormat(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedOption.availableFormats.map(format => {
                    const Icon = formatIcons[format];
                    return (
                      <SelectItem key={format} value={format}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {formatLabels[format]}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-sm text-muted-foreground">
                Ready to export "{selectedOption.title}"
              </div>
              <Button 
                onClick={handleExport} 
                disabled={isExporting}
                size="sm"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
              </Button>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-sm text-muted-foreground border-t pt-4">
          <p>
            Need more control? Use the <strong>Custom Report Builder</strong> for advanced filtering and field selection.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}