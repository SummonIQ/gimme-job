"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LinkedInOneClickApply } from "@/components/linkedin/linkedin-one-click-apply";
import { 
  Linkedin, 
  Search, 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Zap,
  Shield,
  TrendingUp,
  MapPin,
  DollarSign,
  Filter,
  RefreshCw,
  History,
  Settings,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

interface LinkedInJob {
  id: string;
  title: string;
  company: {
    name: string;
    logo?: string;
  };
  location: {
    city?: string;
    country?: string;
    remote?: boolean;
  };
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  postedAt: Date;
  easyApply: boolean;
  appliedCount?: number;
  applied?: boolean;
}

interface ApplicationStats {
  total: number;
  submitted: number;
  pending: number;
  failed: number;
  todayCount: number;
  weekCount: number;
  successRate: number;
}

export function LinkedInAutomationDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [easyApplyOnly, setEasyApplyOnly] = useState(true);
  const [jobs, setJobs] = useState<LinkedInJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<LinkedInJob | null>(null);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [stats, setStats] = useState<ApplicationStats>({
    total: 0,
    submitted: 0,
    pending: 0,
    failed: 0,
    todayCount: 0,
    weekCount: 0,
    successRate: 0,
  });
  const [rateLimits, setRateLimits] = useState({
    daily: { used: 0, limit: 50 },
    hourly: { used: 0, limit: 10 },
    api: { used: 0, limit: 200 },
  });

  useEffect(() => {
    checkLinkedInConnection();
    fetchApplicationStats();
    fetchRateLimits();
  }, []);

  const checkLinkedInConnection = async () => {
    try {
      const response = await fetch("/api/linkedin/status");
      const data = await response.json();
      setIsConnected(data.connected);
    } catch (error) {
      console.error("Error checking LinkedIn connection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApplicationStats = async () => {
    try {
      const response = await fetch("/api/automation/analytics?platform=LINKEDIN");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchRateLimits = async () => {
    try {
      const response = await fetch("/api/linkedin/rate-limits");
      const data = await response.json();
      setRateLimits(data);
    } catch (error) {
      console.error("Error fetching rate limits:", error);
    }
  };

  const searchJobs = async () => {
    if (!searchQuery) {
      toast.error("Please enter a search query");
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        keywords: searchQuery,
        location: location || "",
        easyApply: easyApplyOnly.toString(),
        limit: "25",
      });

      const response = await fetch(`/api/linkedin/jobs/search?${params}`);
      if (!response.ok) throw new Error("Failed to search jobs");
      
      const data = await response.json();
      setJobs(data.jobs);
      toast.success(`Found ${data.jobs.length} jobs`);
    } catch (error) {
      console.error("Error searching jobs:", error);
      toast.error("Failed to search LinkedIn jobs");
    } finally {
      setIsLoading(false);
    }
  };

  const prepareApplication = async (job: LinkedInJob) => {
    try {
      const response = await fetch(`/api/linkedin/jobs/${job.id}/prepare`);
      if (!response.ok) throw new Error("Failed to prepare application");
      
      const data = await response.json();
      setApplicationData(data);
      setSelectedJob(job);
      setShowApplyModal(true);
    } catch (error) {
      console.error("Error preparing application:", error);
      toast.error("Failed to prepare application");
    }
  };

  const handleApply = async (data: any) => {
    try {
      const response = await fetch("/api/linkedin/jobs/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to submit application");
      
      const result = await response.json();
      toast.success("Application submitted successfully!");
      
      // Refresh stats and rate limits
      fetchApplicationStats();
      fetchRateLimits();
      
      // Mark job as applied
      setJobs(prev => prev.map(j => 
        j.id === selectedJob?.id ? { ...j, applied: true } : j
      ));
      
      setShowApplyModal(false);
      setSelectedJob(null);
    } catch (error) {
      console.error("Error applying to job:", error);
      toast.error("Failed to submit application");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle>LinkedIn Not Connected</AlertTitle>
        <AlertDescription>
          Connect your LinkedIn account to start automating applications.
          <Button 
            className="mt-3"
            onClick={() => window.location.href = "/linkedin"}
          >
            Connect LinkedIn
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.successRate}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Applications</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayCount}</div>
            <Progress 
              value={(stats.todayCount / rateLimits.daily.limit) * 100} 
              className="mt-2 h-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {rateLimits.daily.limit - stats.todayCount} remaining today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hourly Limit</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rateLimits.hourly.used}/{rateLimits.hourly.limit}
            </div>
            <Progress 
              value={(rateLimits.hourly.used / rateLimits.hourly.limit) * 100} 
              className="mt-2 h-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Resets in 47 minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rateLimits.api.used}/{rateLimits.api.limit}
            </div>
            <Progress 
              value={(rateLimits.api.used / rateLimits.api.limit) * 100} 
              className="mt-2 h-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Daily API limit
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="search" className="space-y-4">
        <TabsList>
          <TabsTrigger value="search">Job Search</TabsTrigger>
          <TabsTrigger value="queue">Application Queue</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search LinkedIn Jobs</CardTitle>
              <CardDescription>
                Find and apply to jobs with one-click automation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      placeholder="e.g., Software Engineer"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchJobs()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g., San Francisco, CA"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="easy-apply"
                        checked={easyApplyOnly}
                        onCheckedChange={setEasyApplyOnly}
                      />
                      <Label htmlFor="easy-apply">Easy Apply Only</Label>
                    </div>
                    <Button onClick={searchJobs} disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Search
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {jobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  {jobs.length} jobs found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold">{job.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {job.company.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {job.easyApply && (
                              <Badge variant="secondary">
                                <Zap className="w-3 h-3 mr-1" />
                                Easy Apply
                              </Badge>
                            )}
                            {job.applied && (
                              <Badge variant="outline" className="border-green-500 text-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Applied
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.location.city || job.location.country}
                            {job.location.remote && " (Remote)"}
                          </div>
                          {job.salary && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {job.salary.currency} {job.salary.min?.toLocaleString()}-
                              {job.salary.max?.toLocaleString()}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(job.postedAt).toLocaleDateString()}
                          </div>
                          {job.appliedCount && (
                            <div className="flex items-center gap-1">
                              {job.appliedCount} applicants
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => prepareApplication(job)}
                            disabled={job.applied || rateLimits.hourly.used >= rateLimits.hourly.limit}
                          >
                            {job.applied ? "Already Applied" : "Apply Now"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`https://www.linkedin.com/jobs/view/${job.id}`, "_blank")}
                          >
                            View on LinkedIn
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application Queue</CardTitle>
              <CardDescription>
                Manage pending and scheduled LinkedIn applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No pending applications in queue
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application History</CardTitle>
              <CardDescription>
                View your LinkedIn application history and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Application history will appear here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LinkedIn Automation Settings</CardTitle>
              <CardDescription>
                Configure your LinkedIn automation preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Daily Application Limit</Label>
                <div className="text-sm text-muted-foreground">
                  Maximum: 50 applications per day (LinkedIn restriction)
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Hourly Application Limit</Label>
                <div className="text-sm text-muted-foreground">
                  Maximum: 10 applications per hour (recommended for safety)
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-approve Easy Apply</Label>
                  <div className="text-sm text-muted-foreground">
                    Automatically submit Easy Apply applications without review
                  </div>
                </div>
                <Switch disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Application Modal */}
      {showApplyModal && selectedJob && applicationData && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-h-[90vh] overflow-y-auto">
            <LinkedInOneClickApply
              job={selectedJob as any}
              applicationData={applicationData}
              onApply={handleApply}
              onCancel={() => {
                setShowApplyModal(false);
                setSelectedJob(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}