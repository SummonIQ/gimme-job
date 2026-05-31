"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runResponsivenessAudit, ResponsivenessIssue } from "@/lib/mobile/responsive-audit";
import { AlertCircle, CheckCircle2, Smartphone, ArrowRight, Loader2 } from "lucide-react";

interface ResponsivenessAuditReportProps {
  initialData?: {
    timestamp: Date;
    issues: ResponsivenessIssue[];
    score: number;
    totalComponents: number;
    issuesByCategory: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

export function ResponsivenessAuditReport({ initialData }: ResponsivenessAuditReportProps) {
  const [auditData, setAuditData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Run a new responsiveness audit
  const handleRunAudit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await runResponsivenessAudit();
      setAuditData(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred while running the audit");
    } finally {
      setLoading(false);
    }
  };

  // Get the score color based on the value
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  // Get severity badge
  const getSeverityBadge = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Smartphone className="h-5 w-5 mr-2" />
          Mobile Responsiveness Audit
        </CardTitle>
        <CardDescription>
          Analyze how well the application works on mobile devices
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {!auditData ? (
          <div className="text-center py-12">
            <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              No Mobile Audit Data Available
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Run a mobile responsiveness audit to check how well the application performs on mobile devices.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Mobile Responsiveness Score</h3>
                <span className={`text-2xl font-bold ${getScoreColor(auditData.score)}`}>
                  {auditData.score}/100
                </span>
              </div>
              <Progress value={auditData.score} className="h-2" />
              
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="bg-background border rounded-md px-3 py-2 text-center">
                  <span className="text-sm text-muted-foreground block">High</span>
                  <span className="text-lg font-semibold text-red-500">{auditData.issuesByCategory.high}</span>
                </div>
                <div className="bg-background border rounded-md px-3 py-2 text-center">
                  <span className="text-sm text-muted-foreground block">Medium</span>
                  <span className="text-lg font-semibold text-amber-500">{auditData.issuesByCategory.medium}</span>
                </div>
                <div className="bg-background border rounded-md px-3 py-2 text-center">
                  <span className="text-sm text-muted-foreground block">Low</span>
                  <span className="text-lg font-semibold text-green-600">{auditData.issuesByCategory.low}</span>
                </div>
                <div className="bg-background border rounded-md px-3 py-2 text-center">
                  <span className="text-sm text-muted-foreground block">Total</span>
                  <span className="text-lg font-semibold">{auditData.issues.length}</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                Last updated: {new Date(auditData.timestamp).toLocaleString()}
              </p>
            </div>

            {auditData.issues.length > 0 ? (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="all">All Issues</TabsTrigger>
                  <TabsTrigger value="high">High Priority</TabsTrigger>
                  <TabsTrigger value="medium">Medium Priority</TabsTrigger>
                  <TabsTrigger value="low">Low Priority</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="space-y-4">
                  {auditData.issues.map((issue, index) => (
                    <IssueCard key={index} issue={issue} />
                  ))}
                </TabsContent>
                
                <TabsContent value="high" className="space-y-4">
                  {auditData.issues
                    .filter(issue => issue.severity === 'high')
                    .map((issue, index) => (
                      <IssueCard key={index} issue={issue} />
                    ))}
                </TabsContent>
                
                <TabsContent value="medium" className="space-y-4">
                  {auditData.issues
                    .filter(issue => issue.severity === 'medium')
                    .map((issue, index) => (
                      <IssueCard key={index} issue={issue} />
                    ))}
                </TabsContent>
                
                <TabsContent value="low" className="space-y-4">
                  {auditData.issues
                    .filter(issue => issue.severity === 'low')
                    .map((issue, index) => (
                      <IssueCard key={index} issue={issue} />
                    ))}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 border-2 border-dashed rounded-md">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p className="font-medium">No issues found!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The application is fully responsive on mobile devices.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-end">
        <Button 
          onClick={handleRunAudit} 
          disabled={loading}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {auditData ? 'Run New Audit' : 'Run Mobile Audit'}
        </Button>
      </CardFooter>
    </Card>
  );
}

// Issue card component
function IssueCard({ issue }: { issue: ResponsivenessIssue }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {issue.severity === 'high' && <AlertCircle className="h-4 w-4 text-red-500" />}
              <h4 className="font-medium">{issue.component}</h4>
              {getSeverityBadge(issue.severity)}
            </div>
            <p className="text-xs text-muted-foreground mb-2">Path: {issue.path}</p>
            <p className="text-sm">{issue.description}</p>
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-2 bg-muted/50 p-3 rounded-md">
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm">{issue.suggestedFix}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function for severity badge
function getSeverityBadge(severity: 'high' | 'medium' | 'low') {
  switch (severity) {
    case 'high':
      return <Badge variant="destructive">High</Badge>;
    case 'medium':
      return <Badge variant="default" className="bg-amber-500">Medium</Badge>;
    case 'low':
      return <Badge variant="outline">Low</Badge>;
    default:
      return null;
  }
}
