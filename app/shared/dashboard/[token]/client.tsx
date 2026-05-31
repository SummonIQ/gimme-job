'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AnalyticsOverview } from '@/components/analytics/overview';
import { JobLeadMetrics } from '@/components/analytics/job-lead-metrics';
import { ResumeMetrics } from '@/components/analytics/resume-metrics';
import { toast } from 'sonner';
import { 
  Lock, 
  Eye, 
  Calendar,
  TrendingUp,
  Users,
  FileText,
  BarChart3,
  AlertCircle,
  Share
} from 'lucide-react';
import { cn } from '@/lib/css/index';
import { format } from 'date-fns';
import type { ShareableDashboardData } from '@/lib/exports/shareable-dashboards';

interface ShareableDashboardClientProps {
  token: string;
  requiresPassword?: boolean;
  error?: string;
  dashboardData?: ShareableDashboardData;
}

export function ShareableDashboardClient({
  token,
  requiresPassword,
  error,
  dashboardData
}: ShareableDashboardClientProps) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      toast.error('Please enter the password');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Reload page with password parameter
      const url = new URL(window.location.href);
      url.searchParams.set('password', password);
      window.location.href = url.toString();
    } catch (error) {
      console.error('Error submitting password:', error);
      toast.error('Failed to submit password');
      setIsSubmitting(false);
    }
  };

  // Show password form if required
  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Password Protected Dashboard</CardTitle>
            <CardDescription>
              This shared dashboard is password protected. Please enter the password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                disabled={isSubmitting}
              />
            </div>
            
            <Button 
              className="w-full" 
              onClick={handlePasswordSubmit}
              disabled={isSubmitting || !password.trim()}
            >
              {isSubmitting ? 'Verifying...' : 'Access Dashboard'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if no data available
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Dashboard Not Available</CardTitle>
            <CardDescription>
              This shared dashboard could not be loaded. The link may be expired or invalid.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { link, analytics, metadata } = dashboardData;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Share className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">{link.name}</h1>
                <Badge variant="outline">Shared Dashboard</Badge>
              </div>
              
              {link.description && (
                <p className="text-muted-foreground">{link.description}</p>
              )}
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Generated {format(metadata.generatedAt, 'MMM dd, yyyy HH:mm')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{link.accessCount} views</span>
                </div>
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>{metadata.recordCount} records</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Applications</p>
                    <p className="text-2xl font-bold">{analytics.overview.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Response Rate</p>
                    <p className="text-2xl font-bold">{analytics.responseRates.responseRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interview Rate</p>
                    <p className="text-2xl font-bold">{analytics.responseRates.interviewRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Offer Rate</p>
                    <p className="text-2xl font-bold">{analytics.responseRates.offerRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Analytics Sections */}
          {link.dashboardConfig.dataTypes.includes('applications') && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Application Analytics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Application Status Distribution</CardTitle>
                    <CardDescription>
                      Breakdown of application statuses over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <JobLeadMetrics />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Application Timeline</CardTitle>
                    <CardDescription>
                      Average time to response and interview
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Average time to first response</span>
                          <span className="font-medium">
                            {analytics.timeToResponse.averageDaysToFirstResponse 
                              ? `${analytics.timeToResponse.averageDaysToFirstResponse.toFixed(1)} days`
                              : 'No data'
                            }
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Average time to interview</span>
                          <span className="font-medium">
                            {analytics.timeToResponse.averageDaysToInterview 
                              ? `${analytics.timeToResponse.averageDaysToInterview.toFixed(1)} days`
                              : 'No data'
                            }
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Average time to offer</span>
                          <span className="font-medium">
                            {analytics.timeToResponse.averageDaysToOffer 
                              ? `${analytics.timeToResponse.averageDaysToOffer.toFixed(1)} days`
                              : 'No data'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Job Board Performance */}
          {analytics.jobProviderPerformance.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Job Board Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.jobProviderPerformance.map((board, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="space-y-2">
                        <h3 className="font-semibold">{board.jobProvider}</h3>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Applications:</span>
                            <span className="font-medium">{board.applications}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Response Rate:</span>
                            <span className="font-medium">{board.responseRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Interview Rate:</span>
                            <span className="font-medium">{board.interviewRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Offer Rate:</span>
                            <span className="font-medium">{board.offerRate.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Resume Performance */}
          {link.dashboardConfig.dataTypes.includes('resumes') && analytics.resumePerformance.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Resume Performance</h2>
              <Card>
                <CardHeader>
                  <CardTitle>Resume Effectiveness</CardTitle>
                  <CardDescription>
                    Performance metrics for different resume versions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResumeMetrics />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Footer */}
          <div className="pt-8 border-t">
            <div className="text-center text-sm text-muted-foreground">
              <p>This dashboard was shared securely and is read-only.</p>
              <p className="mt-1">
                Data range: {format(metadata.dateRange.start, 'MMM dd, yyyy')} - {format(metadata.dateRange.end, 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}