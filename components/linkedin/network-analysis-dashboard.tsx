"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { NetworkVisualization } from "./network-visualization";
import {
  GitBranch,
  Users,
  TrendingUp,
  Target,
  BarChart3,
  AlertCircle,
  RefreshCw,
  Download,
  ChevronRight,
  User,
  Building2,
  MapPin,
  Briefcase,
  Link2,
  Activity,
  Eye,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

interface NetworkData {
  nodes: any[];
  links: any[];
  clusters: any[];
  metrics: any;
}

interface NetworkGap {
  id: string;
  type: string;
  title: string;
  description: string;
  importance: string;
  currentCoverage: number;
  targetCoverage: number;
  suggestedConnections: any[];
  actionItems: string[];
}

interface GrowthMetrics {
  currentSize: number;
  monthlyGrowth: number;
  growthRate: number;
  qualityScore: number;
  engagementScore: number;
  projectedSize: any[];
  topGrowthPeriods: any[];
}

interface ConnectionPath {
  targetName: string;
  targetTitle: string;
  targetCompany: string;
  paths: any[];
  recommendedPath: any;
  difficulty: string;
}

export function NetworkAnalysisDashboard() {
  const [loading, setLoading] = useState(true);
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [networkGaps, setNetworkGaps] = useState<NetworkGap[]>([]);
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetrics | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<any>(null);
  const [networkHealth, setNetworkHealth] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedGap, setSelectedGap] = useState<NetworkGap | null>(null);
  const [targetProfile, setTargetProfile] = useState<string>("");
  const [connectionPath, setConnectionPath] = useState<ConnectionPath | null>(null);

  useEffect(() => {
    loadNetworkData();
  }, []);

  const loadNetworkData = async () => {
    setLoading(true);
    try {
      // Load all network data in parallel
      const [network, gaps, growth, quality, health] = await Promise.all([
        fetch("/api/linkedin/network/graph").then(r => r.json()),
        fetch("/api/linkedin/network/gaps").then(r => r.json()),
        fetch("/api/linkedin/network/growth").then(r => r.json()),
        fetch("/api/linkedin/network/quality").then(r => r.json()),
        fetch("/api/linkedin/network/health").then(r => r.json()),
      ]);

      setNetworkData(network);
      setNetworkGaps(gaps);
      setGrowthMetrics(growth);
      setConnectionQuality(quality);
      setNetworkHealth(health);
    } catch (error) {
      console.error("Failed to load network data:", error);
      toast.error("Failed to load network data");
    } finally {
      setLoading(false);
    }
  };

  const analyzeConnectionStrength = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/linkedin/network/strength/${connectionId}`);
      const data = await response.json();
      setSelectedNode(data);
      toast.success("Connection strength analyzed");
    } catch (error) {
      toast.error("Failed to analyze connection");
    }
  };

  const findConnectionPath = async () => {
    if (!targetProfile) {
      toast.error("Please enter a target profile name");
      return;
    }

    try {
      const response = await fetch("/api/linkedin/network/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetName: targetProfile }),
      });
      const data = await response.json();
      setConnectionPath(data);
      toast.success("Connection path found");
    } catch (error) {
      toast.error("Failed to find connection path");
    }
  };

  const exportNetworkData = () => {
    const dataStr = JSON.stringify({ networkData, networkGaps, growthMetrics }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "network-analysis.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Network data exported");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-blue-500" />
              <Badge variant="outline">Network</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{growthMetrics?.currentSize || 0}</div>
            <p className="text-sm text-muted-foreground">Total Connections</p>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-green-500">+{growthMetrics?.monthlyGrowth || 0}</span>
              <span className="text-muted-foreground">this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Activity className="h-5 w-5 text-green-500" />
              <Badge variant="outline">Health</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{networkHealth?.overall || 0}%</div>
            <p className="text-sm text-muted-foreground">Network Health</p>
            <Progress value={networkHealth?.overall || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Target className="h-5 w-5 text-amber-500" />
              <Badge variant="outline">Gaps</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{networkGaps.length}</div>
            <p className="text-sm text-muted-foreground">Network Gaps</p>
            <div className="flex items-center gap-1 mt-2">
              {networkGaps.filter(g => g.importance === "critical").length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {networkGaps.filter(g => g.importance === "critical").length} Critical
                </Badge>
              )}
              {networkGaps.filter(g => g.importance === "high").length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {networkGaps.filter(g => g.importance === "high").length} High
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <Badge variant="outline">Quality</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{growthMetrics?.qualityScore || 0}%</div>
            <p className="text-sm text-muted-foreground">Connection Quality</p>
            <div className="flex gap-1 mt-2">
              <div className="flex-1 h-2 bg-green-500 rounded" style={{ width: `${connectionQuality?.highQuality || 0}%` }} title="High Quality" />
              <div className="flex-1 h-2 bg-amber-500 rounded" style={{ width: `${connectionQuality?.mediumQuality || 0}%` }} title="Medium Quality" />
              <div className="flex-1 h-2 bg-red-500 rounded" style={{ width: `${connectionQuality?.lowQuality || 0}%` }} title="Low Quality" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="visualization" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="visualization">
            <GitBranch className="h-4 w-4 mr-2" />
            Visualization
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <Target className="h-4 w-4 mr-2" />
            Network Gaps
          </TabsTrigger>
          <TabsTrigger value="growth">
            <TrendingUp className="h-4 w-4 mr-2" />
            Growth Analysis
          </TabsTrigger>
          <TabsTrigger value="paths">
            <Link2 className="h-4 w-4 mr-2" />
            Connection Paths
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            Network Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visualization" className="space-y-4">
          {networkData && (
            <NetworkVisualization
              nodes={networkData.nodes}
              links={networkData.links}
              clusters={networkData.clusters}
              onNodeClick={(node) => analyzeConnectionStrength(node.id)}
            />
          )}

          {selectedNode && (
            <Card>
              <CardHeader>
                <CardTitle>Connection Analysis</CardTitle>
                <CardDescription>Relationship strength breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Overall Strength</span>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedNode.overallScore} className="w-32" />
                      <span className="font-bold">{selectedNode.overallScore}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(selectedNode.factors || {}).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-sm text-muted-foreground">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={value as number} className="flex-1" />
                          <span className="text-sm font-medium">{value}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedNode.recommendations?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Recommendations</h4>
                      <ul className="space-y-1">
                        {selectedNode.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <div className="grid gap-4">
            {networkGaps.map((gap) => (
              <Card key={gap.id} className={`border-l-4 ${
                gap.importance === "critical" ? "border-l-red-500" :
                gap.importance === "high" ? "border-l-amber-500" :
                gap.importance === "medium" ? "border-l-yellow-500" :
                "border-l-gray-500"
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{gap.title}</CardTitle>
                      <Badge variant={
                        gap.importance === "critical" ? "destructive" :
                        gap.importance === "high" ? "default" :
                        "secondary"
                      }>
                        {gap.importance}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedGap(gap)}
                    >
                      View Details
                    </Button>
                  </div>
                  <CardDescription>{gap.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Current Coverage</span>
                        <span>{gap.currentCoverage}% / {gap.targetCoverage}%</span>
                      </div>
                      <Progress value={gap.currentCoverage} max={gap.targetCoverage} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {gap.actionItems.slice(0, 3).map((action, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {action}
                        </Badge>
                      ))}
                      {gap.actionItems.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{gap.actionItems.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedGap && (
            <Card>
              <CardHeader>
                <CardTitle>Suggested Connections for {selectedGap.title}</CardTitle>
                <CardDescription>People who can help close this network gap</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedGap.suggestedConnections.map((connection, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{connection.name}</div>
                        <div className="text-sm text-muted-foreground">{connection.title} at {connection.company}</div>
                        <div className="text-sm mt-1">{connection.reason}</div>
                      </div>
                      <Button size="sm">Connect</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Growth Trend</CardTitle>
                <CardDescription>Network growth over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Growth Rate</span>
                    <Badge variant={growthMetrics?.growthRate! > 10 ? "default" : "secondary"}>
                      {growthMetrics?.growthRate.toFixed(1)}% / month
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Top Growth Periods</h4>
                    <div className="space-y-2">
                      {growthMetrics?.topGrowthPeriods.map((period, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span>{period.period}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">+{period.growth}</Badge>
                            {period.reason && <span className="text-muted-foreground">{period.reason}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projected Growth</CardTitle>
                <CardDescription>Expected network size over next 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {growthMetrics?.projectedSize.map((projection, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{projection.month}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={(projection.size / (growthMetrics.projectedSize[growthMetrics.projectedSize.length - 1].size)) * 100} className="w-32" />
                        <Badge variant="outline">{projection.size}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Connection Quality Distribution</CardTitle>
              <CardDescription>Breakdown of connection quality levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {connectionQuality?.highQuality || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">High Quality</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-500">
                      {connectionQuality?.mediumQuality || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Medium Quality</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {connectionQuality?.lowQuality || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Low Quality</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-500">
                      {connectionQuality?.dormant || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Dormant</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      <strong>{connectionQuality?.engaged || 0}</strong> engaged connections
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>Last 90 days</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paths" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Find Connection Path</CardTitle>
              <CardDescription>Discover the best way to connect with someone</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter target person's name..."
                  className="flex-1 px-3 py-2 border rounded-lg"
                  value={targetProfile}
                  onChange={(e) => setTargetProfile(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && findConnectionPath()}
                />
                <Button onClick={findConnectionPath}>
                  Find Path
                </Button>
              </div>
            </CardContent>
          </Card>

          {connectionPath && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Path to {connectionPath.targetName}</CardTitle>
                    <CardDescription>
                      {connectionPath.targetTitle} at {connectionPath.targetCompany}
                    </CardDescription>
                  </div>
                  <Badge variant={
                    connectionPath.difficulty === "easy" ? "default" :
                    connectionPath.difficulty === "moderate" ? "secondary" :
                    "destructive"
                  }>
                    {connectionPath.difficulty}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Recommended Path</h4>
                    <div className="space-y-2">
                      {connectionPath.recommendedPath.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-sm font-medium">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{step.action}</div>
                            <div className="text-sm text-muted-foreground">
                              {step.fromName} → {step.toName}
                            </div>
                            {step.talkingPoints?.length > 0 && (
                              <ul className="mt-1 space-y-1">
                                {step.talkingPoints.map((point, pidx) => (
                                  <li key={pidx} className="text-sm text-muted-foreground">
                                    • {point}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                      <div className="font-medium">
                        {(connectionPath.recommendedPath.successProbability * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Est. Time</span>
                      <div className="font-medium">
                        {connectionPath.recommendedPath.estimatedDays} days
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Path Strength</span>
                      <div className="font-medium">
                        {connectionPath.recommendedPath.totalStrength}%
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Health Score</CardTitle>
              <CardDescription>Overall health assessment of your professional network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">Overall Score</span>
                  <div className="flex items-center gap-3">
                    <Progress value={networkHealth?.overall || 0} className="w-32" />
                    <span className="text-3xl font-bold">{networkHealth?.overall || 0}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(networkHealth?.factors || {}).map(([factor, score]) => (
                    <div key={factor} className="text-center">
                      <div className="text-lg font-bold">{score}%</div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {factor}
                      </p>
                      <Progress value={score as number} className="mt-2" />
                    </div>
                  ))}
                </div>

                {networkHealth?.recommendations?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Recommendations</h4>
                    <div className="space-y-2">
                      {networkHealth.recommendations.map((rec: string, idx: number) => (
                        <Alert key={idx}>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{rec}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {networkHealth?.warnings?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Warnings</h4>
                    <div className="space-y-2">
                      {networkHealth.warnings.map((warning: string, idx: number) => (
                        <Alert key={idx} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{warning}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button onClick={loadNetworkData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
        <Button onClick={exportNetworkData}>
          <Download className="h-4 w-4 mr-2" />
          Export Analysis
        </Button>
      </div>
    </div>
  );
}