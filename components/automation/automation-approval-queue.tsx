"use client";

import { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Building2, DollarSign, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface PendingApplication {
  id: string;
  jobLeadId: string;
  jobTitle: string;
  companyName?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  url?: string;
  description?: string;
  createdAt: Date;
  resumeId?: string;
  resumeName?: string;
}

export function AutomationApprovalQueue() {
  const { toast } = useToast();
  const [pendingApplications, setPendingApplications] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    loadPendingApplications();
    loadSettings();
    
    // Poll for new applications every 30 seconds
    const interval = setInterval(loadPendingApplications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/automation/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadPendingApplications = async () => {
    try {
      const response = await fetch('/api/automation/pending-applications');
      if (!response.ok) throw new Error('Failed to fetch pending applications');
      const data = await response.json();
      setPendingApplications(data);
    } catch (error) {
      console.error('Failed to load pending applications:', error);
      toast({
        title: "Error",
        description: "Failed to load pending applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (id: string, approved: boolean) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/automation/approve/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved }),
      });

      if (!response.ok) throw new Error('Failed to process approval');

      toast({
        title: approved ? "Application Approved" : "Application Rejected",
        description: approved ? "The application will be submitted." : "The application has been rejected.",
      });

      // Remove from pending list
      setPendingApplications(prev => prev.filter(app => app.id !== id));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process approval. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    if (max) return `Up to $${max.toLocaleString()}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading pending applications...</div>
        </CardContent>
      </Card>
    );
  }

  if (!settings?.requireUserApproval) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          User approval is currently disabled. Applications will be submitted automatically.
          Enable user approval in safety settings to review applications before submission.
        </AlertDescription>
      </Alert>
    );
  }

  if (pendingApplications.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>No applications pending approval</p>
            <p className="text-sm mt-2">New applications will appear here for your review</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {pendingApplications.length} application{pendingApplications.length > 1 ? 's' : ''} waiting for your approval
        </AlertDescription>
      </Alert>

      {pendingApplications.map((application) => (
        <Card key={application.id} className="overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{application.jobTitle}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-1">
                  {application.companyName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {application.companyName}
                    </span>
                  )}
                  {application.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {application.location}
                    </span>
                  )}
                  {formatSalary(application.salaryMin, application.salaryMax) && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatSalary(application.salaryMin, application.salaryMax)}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(application.createdAt).toLocaleTimeString()}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {application.description && (
              <div className="text-sm text-muted-foreground line-clamp-3">
                {application.description}
              </div>
            )}
            
            {application.resumeName && (
              <div className="text-sm">
                <span className="text-muted-foreground">Resume: </span>
                <span className="font-medium">{application.resumeName}</span>
              </div>
            )}

            <Separator />

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApproval(application.id, false)}
                disabled={processingId === application.id}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleApproval(application.id, true)}
                disabled={processingId === application.id}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve & Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}