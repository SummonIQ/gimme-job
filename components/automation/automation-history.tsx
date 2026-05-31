"use client";

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink,
  Eye,
  Filter,
  RefreshCw
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface ApplicationRecord {
  id: string;
  jobTitle: string;
  company: string;
  jobProvider: string;
  status: 'submitted' | 'failed' | 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  errorMessage?: string;
  jobUrl?: string;
  wasAutomated: boolean;
  ruleName?: string;
}

export function AutomationHistory() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status: string;
    jobProvider: string;
    search: string;
  }>({
    status: 'all',
    jobProvider: 'all',
    search: '',
  });

  useEffect(() => {
    fetchApplicationHistory();
  }, [filter]);

  const fetchApplicationHistory = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to fetch application history
      // For now, using mock data
      setTimeout(() => {
        setApplications([
          {
            id: '1',
            jobTitle: 'Senior React Developer',
            company: 'TechCorp Inc.',
            jobProvider: 'LINKEDIN',
            status: 'submitted',
            submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            wasAutomated: true,
            ruleName: 'Senior Developer Applications',
            jobUrl: 'https://example.com/job/1'
          },
          {
            id: '2',
            jobTitle: 'Frontend Engineer',
            company: 'StartupXYZ',
            jobProvider: 'INDEED',
            status: 'failed',
            submittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
            wasAutomated: true,
            ruleName: 'Senior Developer Applications',
            errorMessage: 'Failed to submit: Missing required field'
          },
          {
            id: '3',
            jobTitle: 'Full Stack Developer',
            company: 'MegaCorp',
            jobProvider: 'GLASSDOOR',
            status: 'pending',
            submittedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
            wasAutomated: true,
            ruleName: 'Senior Developer Applications'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch application history:', error);
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ApplicationRecord['status']) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: ApplicationRecord['status']) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-green-500">Submitted</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesStatus = filter.status === 'all' || app.status === filter.status;
    const matchesJobProvider = filter.jobProvider === 'all' || app.jobProvider === filter.jobProvider;
    const matchesSearch = filter.search === '' || 
      app.jobTitle.toLowerCase().includes(filter.search.toLowerCase()) ||
      app.company.toLowerCase().includes(filter.search.toLowerCase());
    
    return matchesStatus && matchesJobProvider && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading application history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search jobs or companies..."
          value={filter.search}
          onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
          className="sm:flex-1"
        />
        
        <Select
          value={filter.status}
          onValueChange={(status) => setFilter(prev => ({ ...prev, status }))}
        >
          <SelectTrigger className="sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filter.jobProvider}
          onValueChange={(jobProvider) => setFilter(prev => ({ ...prev, jobProvider }))}
        >
          <SelectTrigger className="sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Boards</SelectItem>
            <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
            <SelectItem value="INDEED">Indeed</SelectItem>
            <SelectItem value="GLASSDOOR">Glassdoor</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={fetchApplicationHistory}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Application List */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {applications.length === 0 ? (
            <div className="space-y-2">
              <Eye className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p>No applications yet</p>
              <p className="text-sm">Start automation to see your application history here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Filter className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p>No applications match your filters</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              className="border rounded-lg p-4 space-y-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{app.jobTitle}</h4>
                    {app.jobUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        asChild
                      >
                        <a 
                          href={app.jobUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{app.company}</p>
                  {app.ruleName && (
                    <p className="text-xs text-muted-foreground">
                      Rule: {app.ruleName}
                    </p>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(app.status)}
                  <Badge variant="outline" className="text-xs">
                    {app.jobProvider}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {getStatusIcon(app.status)}
                  <span>
                    {app.status === 'submitted' && 'Application submitted'}
                    {app.status === 'failed' && 'Application failed'}
                    {app.status === 'pending' && 'Waiting for approval'}
                    {app.status === 'approved' && 'Application approved'}
                    {app.status === 'rejected' && 'Application rejected'}
                  </span>
                </div>
                <span>{app.submittedAt.toLocaleString()}</span>
              </div>

              {app.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-800">{app.errorMessage}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredApplications.length > 0 && (
        <div className="text-center">
          <Button variant="outline" size="sm">
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}