"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { OrganizationalChart } from "./organizational-chart";
import {
  Building2,
  Users,
  TrendingUp,
  Target,
  BarChart3,
  Search,
  RefreshCw,
  Download,
  ExternalLink,
  MapPin,
  Calendar,
  DollarSign,
  Star,
  MessageSquare,
  Network,
  Briefcase,
  Award,
  Globe,
  ChevronRight,
  Crown,
  Eye,
  UserPlus,
  Building,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { CompanyProfile, NetworkingOpportunity, CompanyComparison } from "@/lib/linkedin/company-research";

export function CompanyResearchDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyProfile | null>(null);
  const [networkingOps, setNetworkingOps] = useState<NetworkingOpportunity[]>([]);
  const [comparison, setComparison] = useState<CompanyComparison | null>(null);
  const [orgChartData, setOrgChartData] = useState<{ nodes: any[]; relationships: any[] } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [comparisonCompanies, setComparisonCompanies] = useState<string[]>([]);

  const searchCompany = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    setLoading(true);
    try {
      const [company, orgChart, opportunities] = await Promise.all([
        fetch(`/api/linkedin/company/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyIdentifier: searchQuery,
            options: {
              includeEmployees: true,
              includeFinancials: true,
              includeCulture: true,
              includeJobs: true,
              includeNetworkConnections: true,
            }
          }),
        }).then(r => r.json()),
        fetch(`/api/linkedin/company/org-chart`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyIdentifier: searchQuery }),
        }).then(r => r.json()),
        fetch(`/api/linkedin/company/networking-opportunities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyIdentifier: searchQuery }),
        }).then(r => r.json()),
      ]);

      setCompanyData(company);
      setOrgChartData(orgChart);
      setNetworkingOps(opportunities);
      toast.success(`Research completed for ${company.name}`);
    } catch (error) {
      console.error("Company research failed:", error);
      toast.error("Failed to research company");
    } finally {
      setLoading(false);
    }
  };

  const addToComparison = () => {
    if (companyData && !comparisonCompanies.includes(companyData.name)) {
      setComparisonCompanies(prev => [...prev, companyData.name]);
      toast.success(`${companyData.name} added to comparison`);
    }
  };

  const runComparison = async () => {
    if (comparisonCompanies.length < 2) {
      toast.error("Add at least 2 companies to compare");
      return;
    }

    setLoading(true);
    try {
      const result = await fetch(`/api/linkedin/company/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: comparisonCompanies }),
      }).then(r => r.json());

      setComparison(result);
      toast.success("Company comparison completed");
    } catch (error) {
      toast.error("Failed to compare companies");
    } finally {
      setLoading(false);
    }
  };

  const connectToEmployee = async (employee: any) => {
    try {
      await fetch(`/api/linkedin/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileUrl: employee.linkedInUrl,
          message: `Hi ${employee.name}, I'm interested in learning about opportunities at ${companyData?.name}. Would love to connect!`,
        }),
      });
      toast.success(`Connection request sent to ${employee.name}`);
    } catch (error) {
      toast.error("Failed to send connection request");
    }
  };

  if (loading && !companyData) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Enter company name, LinkedIn URL, or website..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCompany()}
            />
          </div>
          <Button onClick={searchCompany} disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            {loading ? "Researching..." : "Research Company"}
          </Button>
          {companyData && (
            <Button variant="outline" onClick={addToComparison}>
              Add to Compare
            </Button>
          )}
        </div>
      </Card>

      {/* Company Overview */}
      {companyData && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={companyData.logoUrl} />
                    <AvatarFallback>
                      <Building2 className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl">{companyData.name}</CardTitle>
                    <CardDescription className="text-lg">{companyData.industry}</CardDescription>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {companyData.headquarters}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {companyData.size}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Founded {companyData.founded}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    LinkedIn
                  </Button>
                  <Button variant="outline" size="sm">
                    <Globe className="h-4 w-4 mr-2" />
                    Website
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{companyData.description}</p>
              {companyData.specialties.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Specialties</h4>
                  <div className="flex flex-wrap gap-2">
                    {companyData.specialties.map(specialty => (
                      <Badge key={specialty} variant="outline">{specialty}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Users className="h-5 w-5 text-blue-500" />
                  <Badge variant="outline">Size</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {companyData.statistics.employeeCount.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <div className="flex items-center gap-1 mt-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">+{companyData.statistics.employeeGrowth}%</span>
                  <span className="text-muted-foreground">growth</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Network className="h-5 w-5 text-green-500" />
                  <Badge variant="outline">Network</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {companyData.networkConnections?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Your Connections</p>
                <div className="mt-2">
                  <Progress value={(companyData.networkConnections?.length || 0) * 10} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Star className="h-5 w-5 text-amber-500" />
                  <Badge variant="outline">Culture</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {companyData.statistics.glassdoorRating?.toFixed(1) || "N/A"}
                </div>
                <p className="text-sm text-muted-foreground">Glassdoor Rating</p>
                <div className="flex items-center gap-1 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < Math.floor(companyData.statistics.glassdoorRating || 0)
                          ? "text-amber-400 fill-amber-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Briefcase className="h-5 w-5 text-purple-500" />
                  <Badge variant="outline">Jobs</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {companyData.jobs?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Open Positions</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    {companyData.jobs?.filter(j => j.internalReferralPossible).length || 0} referral-friendly
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">
                <Building className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="people">
                <Users className="h-4 w-4 mr-2" />
                People
              </TabsTrigger>
              <TabsTrigger value="org-chart">
                <Crown className="h-4 w-4 mr-2" />
                Org Chart
              </TabsTrigger>
              <TabsTrigger value="networking">
                <Target className="h-4 w-4 mr-2" />
                Networking
              </TabsTrigger>
              <TabsTrigger value="jobs">
                <Briefcase className="h-4 w-4 mr-2" />
                Jobs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Company Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>LinkedIn Followers</span>
                      <span className="font-medium">
                        {companyData.statistics.linkedInFollowers.toLocaleString()}
                      </span>
                    </div>
                    {companyData.statistics.industryRank && (
                      <div className="flex justify-between">
                        <span>Industry Rank</span>
                        <Badge variant="outline">#{companyData.statistics.industryRank}</Badge>
                      </div>
                    )}
                    {companyData.financials && (
                      <>
                        <div className="flex justify-between">
                          <span>Revenue</span>
                          <span className="font-medium">{companyData.financials.revenue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Funding</span>
                          <span className="font-medium">{companyData.financials.funding.totalFunding}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Updates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {companyData.recentUpdates.length > 0 ? (
                      <div className="space-y-3">
                        {companyData.recentUpdates.slice(0, 3).map(update => (
                          <div key={update.id} className="border-l-2 border-blue-500 pl-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {update.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(update.date).toLocaleDateString()}
                              </span>
                            </div>
                            <h4 className="font-medium">{update.title}</h4>
                            <p className="text-sm text-muted-foreground">{update.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No recent updates available</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {companyData.locations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Locations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {companyData.locations.map(location => (
                        <div key={location.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {location.city}, {location.country}
                            </span>
                            {location.isHeadquarters && (
                              <Badge variant="outline" className="text-xs">HQ</Badge>
                            )}
                          </div>
                          {location.employeeCount && (
                            <p className="text-sm text-muted-foreground mt-1">
                              ~{location.employeeCount.toLocaleString()} employees
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="people" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Key People</CardTitle>
                  <CardDescription>
                    Decision makers and potential contacts at {companyData.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {companyData.keyPeople.map(person => (
                      <div key={person.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={person.profilePicture} />
                            <AvatarFallback>
                              {person.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{person.name}</span>
                              {person.isHiringManager && (
                                <Badge variant="default">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Hiring Manager
                                </Badge>
                              )}
                              {person.isDecisionMaker && (
                                <Badge variant="outline">Decision Maker</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {person.title} • {person.department}
                            </p>
                            {person.connectionDegree && (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={
                                  person.connectionDegree === 1 ? "default" : "secondary"
                                } className="text-xs">
                                  {person.connectionDegree === 1 ? "1st" :
                                   person.connectionDegree === 2 ? "2nd" : "3rd+"} degree
                                </Badge>
                                {person.mutualConnections && person.mutualConnections > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {person.mutualConnections} mutual connections
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedEmployee(person)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => connectToEmployee(person)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Connect
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="org-chart" className="space-y-4">
              {orgChartData && (
                <OrganizationalChart
                  nodes={orgChartData.nodes}
                  relationships={orgChartData.relationships}
                  companyName={companyData.name}
                  onNodeClick={setSelectedEmployee}
                  onConnectRequest={connectToEmployee}
                />
              )}
            </TabsContent>

            <TabsContent value="networking" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Networking Opportunities</CardTitle>
                  <CardDescription>
                    Prioritized list of people to connect with at {companyData.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {networkingOps.map((opportunity, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              opportunity.priority === "high" ? "default" :
                              opportunity.priority === "medium" ? "secondary" : "outline"
                            }>
                              {opportunity.priority} priority
                            </Badge>
                            <Badge variant="outline">
                              {opportunity.type.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant={
                              opportunity.likelihood === "very_high" ? "default" :
                              opportunity.likelihood === "high" ? "secondary" : "outline"
                            }>
                              {opportunity.likelihood.replace(/_/g, " ")} success
                            </Badge>
                          </div>
                          <Button size="sm">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Connect
                          </Button>
                        </div>
                        <h4 className="font-medium">
                          {opportunity.person.name} • {opportunity.person.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          {opportunity.reason}
                        </p>
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">Recommended Actions:</h5>
                          <ul className="space-y-1">
                            {opportunity.actionItems.map((action, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Open Positions</CardTitle>
                  <CardDescription>
                    Current job openings at {companyData.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {companyData.jobs && companyData.jobs.length > 0 ? (
                      companyData.jobs.map(job => (
                        <div key={job.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-medium">{job.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {job.department} • {job.location}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {job.internalReferralPossible && (
                                <Badge variant="default">Referral Friendly</Badge>
                              )}
                              <Badge variant="outline">{job.type}</Badge>
                            </div>
                          </div>
                          {job.salaryRange && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {job.salaryRange.currency}${job.salaryRange.min.toLocaleString()} -
                              ${job.salaryRange.max.toLocaleString()}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Posted {new Date(job.postedDate).toLocaleDateString()}
                            </span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                              <Button size="sm">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Apply
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No open positions found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Comparison Section */}
      {comparisonCompanies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Company Comparison</CardTitle>
                <CardDescription>
                  Compare {comparisonCompanies.length} companies
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setComparisonCompanies([])}>
                  Clear All
                </Button>
                <Button onClick={runComparison} disabled={comparisonCompanies.length < 2}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Compare
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {comparisonCompanies.map(company => (
                <Badge key={company} variant="outline" className="px-3 py-1">
                  {company}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 ml-2"
                    onClick={() => setComparisonCompanies(prev =>
                      prev.filter(c => c !== company)
                    )}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
            </div>

            {comparison && (
              <div className="space-y-4">
                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Top Choice:</strong> {comparison.recommendations.topChoice}
                    <br />
                    <strong>Strategy:</strong> {comparison.recommendations.applicationStrategy}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Network Connections</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {comparison.comparison.networkConnections.map(item => (
                        <div key={item.name} className="flex justify-between mb-2">
                          <span className="text-sm">{item.name}</span>
                          <Badge variant="outline">{item.value}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Company Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {comparison.comparison.size.map(item => (
                        <div key={item.name} className="flex justify-between mb-2">
                          <span className="text-sm">{item.name}</span>
                          <Badge variant="outline">{item.value.toLocaleString()}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Job Openings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {comparison.comparison.jobOpenings.map(item => (
                        <div key={item.name} className="flex justify-between mb-2">
                          <span className="text-sm">{item.name}</span>
                          <Badge variant="outline">{item.value}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button onClick={() => window.location.reload()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
        {companyData && (
          <Button onClick={() => {
            const data = JSON.stringify(companyData, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${companyData.name}-research.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="h-4 w-4 mr-2" />
            Export Research
          </Button>
        )}
      </div>
    </div>
  );
}