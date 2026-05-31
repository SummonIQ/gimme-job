"use client";

import { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditLogEntry {
  id: string;
  action: string;
  actionType: string;
  metadata?: any;
  jobLeadId?: string;
  applicationSubmissionId?: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  'application_submitted': 'Application Submitted',
  'application_blocked': 'Application Blocked',
  'application_approved': 'Application Approved',
  'application_rejected': 'Application Rejected',
  'settings_changed': 'Settings Changed',
  'automation_paused': 'Automation Paused',
  'automation_resumed': 'Automation Resumed',
  'job_allowed': 'Job Allowed',
  'job_blocked': 'Job Blocked',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'success': <CheckCircle className="h-4 w-4 text-green-500" />,
  'blocked': <XCircle className="h-4 w-4 text-red-500" />,
  'error': <AlertCircle className="h-4 w-4 text-red-500" />,
  'warning': <AlertCircle className="h-4 w-4 text-yellow-500" />,
};

export function AutomationAuditLog() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    action: 'all',
    actionType: 'all',
    dateRange: '7d',
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadLogs();
  }, [filters, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });

      if (filters.action !== 'all') {
        params.append('action', filters.action);
      }
      if (filters.actionType !== 'all') {
        params.append('actionType', filters.actionType);
      }

      // Calculate date range
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (filters.dateRange) {
          case '1d':
            startDate.setDate(now.getDate() - 1);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        }
        
        params.append('startDate', startDate.toISOString());
      }

      const response = await fetch(`/api/automation/audit-log?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      
      const data = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      // In a real implementation, this would generate a CSV or JSON file
      toast({
        title: "Export Started",
        description: "Your audit log export is being prepared...",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export audit logs",
        variant: "destructive",
      });
    }
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata) return '-';
    
    const items = [];
    if (metadata.jobTitle) items.push(`Job: ${metadata.jobTitle}`);
    if (metadata.company) items.push(`Company: ${metadata.company}`);
    if (metadata.reason) items.push(`Reason: ${metadata.reason}`);
    if (metadata.blockReason) items.push(`Blocked: ${metadata.blockReason}`);
    
    return items.length > 0 ? items.join(' • ') : '-';
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Automation Audit Log
          </CardTitle>
          <CardDescription>
            Complete history of all automation actions and decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Select value={filters.action} onValueChange={(value) => setFilters({ ...filters, action: value })}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="application_submitted">Applications Submitted</SelectItem>
                <SelectItem value="application_blocked">Applications Blocked</SelectItem>
                <SelectItem value="settings_changed">Settings Changed</SelectItem>
                <SelectItem value="automation_paused">Automation Paused</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.actionType} onValueChange={(value) => setFilters({ ...filters, actionType: value })}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={(value) => setFilters({ ...filters, dateRange: value })}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="icon" onClick={loadLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="icon" onClick={exportLogs}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Logs Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Time</TableHead>
                      <TableHead className="w-[40px]">Type</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {ACTION_ICONS[log.actionType] || <AlertCircle className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            log.actionType === 'success' ? 'success' :
                            log.actionType === 'blocked' ? 'destructive' :
                            log.actionType === 'error' ? 'destructive' :
                            'secondary'
                          }>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatMetadata(log.metadata)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} entries
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}