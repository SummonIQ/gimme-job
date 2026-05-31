'use client';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/css/tailwind';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  Brain,
  CheckCircle,
  FileText,
  Hash,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ResumeMetrics {
  resumeId: string;
  resumeName: string;
  totalApplications: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  atsScore: number;
  optimizationScore: number;
  avgResponseTime: number;
  lastUsed: string;
  performanceTrend: 'up' | 'down' | 'stable';
  isPersonalBest: boolean;
}

interface KeywordAnalysis {
  keyword: string;
  frequency: number;
  applicationCount: number;
  responseRate: number;
  interviewRate: number;
  effectiveness: 'high' | 'medium' | 'low';
}

interface SectionAnalysis {
  section: string;
  wordCount: number;
  keywordDensity: number;
  successRate: number;
  impact: 'positive' | 'neutral' | 'negative';
}

interface ATSScoreTrend {
  date: string;
  score: number;
  resumeName: string;
  changeFromPrevious?: number;
}

interface OptimizationImpact {
  beforeOptimization: {
    atsScore: number;
    responseRate: number;
    interviewRate: number;
  };
  afterOptimization: {
    atsScore: number;
    responseRate: number;
    interviewRate: number;
  };
  improvement: {
    atsScoreChange: number;
    responseRateChange: number;
    interviewRateChange: number;
    percentageImprovement: number;
  };
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

// Chart theme colors for dark mode support
const CHART_COLORS = {
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
  tooltip: {
    bg: 'hsl(var(--popover))',
    border: 'hsl(var(--border))',
    text: 'hsl(var(--popover-foreground))',
  },
};

export default function ResumePerformanceAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedResume, setSelectedResume] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>(
    '30d',
  );
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data - would be fetched from API
  const [data, setData] = useState<{
    resumes: ResumeMetrics[];
    keywords: KeywordAnalysis[];
    sections: SectionAnalysis[];
    atsTrends: ATSScoreTrend[];
    optimizationImpact: OptimizationImpact | null;
    correlations: any;
  }>({
    resumes: [],
    keywords: [],
    sections: [],
    atsTrends: [],
    optimizationImpact: null,
    correlations: null,
  });

  useEffect(() => {
    fetchData();
  }, [selectedResume, timeframe]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      setData({
        resumes: [
          {
            resumeId: '1',
            resumeName: 'Software Engineer - Full Stack',
            totalApplications: 45,
            responseRate: 28.9,
            interviewRate: 15.6,
            offerRate: 6.7,
            atsScore: 85,
            optimizationScore: 92,
            avgResponseTime: 4.2,
            lastUsed: '2024-01-15',
            performanceTrend: 'up',
            isPersonalBest: true,
          },
          {
            resumeId: '2',
            resumeName: 'Senior Developer - React',
            totalApplications: 32,
            responseRate: 21.9,
            interviewRate: 12.5,
            offerRate: 3.1,
            atsScore: 78,
            optimizationScore: 85,
            avgResponseTime: 5.8,
            lastUsed: '2024-01-10',
            performanceTrend: 'stable',
            isPersonalBest: false,
          },
          {
            resumeId: '3',
            resumeName: 'Technical Lead - Original',
            totalApplications: 18,
            responseRate: 16.7,
            interviewRate: 5.6,
            offerRate: 0,
            atsScore: 62,
            optimizationScore: 62,
            avgResponseTime: 8.3,
            lastUsed: '2024-01-05',
            performanceTrend: 'down',
            isPersonalBest: false,
          },
        ],
        keywords: [
          {
            keyword: 'React',
            frequency: 12,
            applicationCount: 35,
            responseRate: 31.4,
            interviewRate: 17.1,
            effectiveness: 'high',
          },
          {
            keyword: 'TypeScript',
            frequency: 8,
            applicationCount: 28,
            responseRate: 28.6,
            interviewRate: 14.3,
            effectiveness: 'high',
          },
          {
            keyword: 'Node.js',
            frequency: 10,
            applicationCount: 30,
            responseRate: 26.7,
            interviewRate: 13.3,
            effectiveness: 'medium',
          },
          {
            keyword: 'AWS',
            frequency: 6,
            applicationCount: 22,
            responseRate: 22.7,
            interviewRate: 9.1,
            effectiveness: 'medium',
          },
          {
            keyword: 'Python',
            frequency: 4,
            applicationCount: 15,
            responseRate: 20.0,
            interviewRate: 6.7,
            effectiveness: 'medium',
          },
          {
            keyword: 'Docker',
            frequency: 5,
            applicationCount: 18,
            responseRate: 16.7,
            interviewRate: 5.6,
            effectiveness: 'low',
          },
          {
            keyword: 'Kubernetes',
            frequency: 3,
            applicationCount: 12,
            responseRate: 8.3,
            interviewRate: 0,
            effectiveness: 'low',
          },
        ],
        sections: [
          {
            section: 'Summary',
            wordCount: 85,
            keywordDensity: 0.15,
            successRate: 28.5,
            impact: 'positive',
          },
          {
            section: 'Experience',
            wordCount: 420,
            keywordDensity: 0.12,
            successRate: 26.8,
            impact: 'positive',
          },
          {
            section: 'Skills',
            wordCount: 65,
            keywordDensity: 0.25,
            successRate: 24.2,
            impact: 'positive',
          },
          {
            section: 'Education',
            wordCount: 45,
            keywordDensity: 0.08,
            successRate: 22.1,
            impact: 'neutral',
          },
          {
            section: 'Projects',
            wordCount: 180,
            keywordDensity: 0.18,
            successRate: 25.5,
            impact: 'positive',
          },
        ],
        atsTrends: [
          {
            date: '2024-01-01',
            score: 62,
            resumeName: 'Original',
            changeFromPrevious: 0,
          },
          {
            date: '2024-01-05',
            score: 68,
            resumeName: 'V1 - Optimized',
            changeFromPrevious: 9.7,
          },
          {
            date: '2024-01-08',
            score: 75,
            resumeName: 'V2 - Keywords',
            changeFromPrevious: 10.3,
          },
          {
            date: '2024-01-10',
            score: 78,
            resumeName: 'V3 - Revised',
            changeFromPrevious: 4.0,
          },
          {
            date: '2024-01-12',
            score: 82,
            resumeName: 'V4 - Tailored',
            changeFromPrevious: 5.1,
          },
          {
            date: '2024-01-15',
            score: 85,
            resumeName: 'V5 - Final',
            changeFromPrevious: 3.7,
          },
        ],
        optimizationImpact: {
          beforeOptimization: {
            atsScore: 62,
            responseRate: 12.5,
            interviewRate: 4.2,
          },
          afterOptimization: {
            atsScore: 85,
            responseRate: 28.9,
            interviewRate: 15.6,
          },
          improvement: {
            atsScoreChange: 23,
            responseRateChange: 16.4,
            interviewRateChange: 11.4,
            percentageImprovement: 37.1,
          },
        },
        correlations: {
          atsScoreToResponseRate: 0.82,
          atsScoreToInterviewRate: 0.75,
          lengthToResponseRate: -0.23,
          keywordCountToSuccessRate: 0.68,
          optimizationScoreToOfferRate: 0.71,
        },
      });
    } catch (error) {
      console.error('Error fetching resume performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEffectivenessColor = (effectiveness: string) => {
    switch (effectiveness) {
      case 'high':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'text-green-600';
      case 'neutral':
        return 'text-gray-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Loading resume performance analytics...
          </p>
        </div>
      </div>
    );
  }

  const bestPerformingResume =
    data.resumes.find(r => r.isPersonalBest) || data.resumes[0];
  const avgAtsScore =
    data.resumes.reduce((sum, r) => sum + r.atsScore, 0) / data.resumes.length;
  const avgResponseRate =
    data.resumes.reduce((sum, r) => sum + r.responseRate, 0) /
    data.resumes.length;

  return (
    <Page name="resume-performance">
      <PageHeader
        title="Resume Performance Analytics"
        description="Track and optimize your resume performance with data-driven insights"
        actions={
          <>
            <Select value={selectedResume} onValueChange={setSelectedResume}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select resume" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resumes</SelectItem>
                {data.resumes.map(resume => (
                  <SelectItem key={resume.resumeId} value={resume.resumeId}>
                    {resume.resumeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={timeframe}
              onValueChange={(value: any) => setTimeframe(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />
      <PageContent className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4" />
                Best Performing Resume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-lg font-bold truncate">
                  {bestPerformingResume.resumeName}
                </p>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">
                    {bestPerformingResume.responseRate.toFixed(1)}% response
                  </Badge>
                  {bestPerformingResume.isPersonalBest && (
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Average ATS Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">
                    {avgAtsScore.toFixed(0)}
                  </div>
                  <div className="text-sm text-muted-foreground">/100</div>
                </div>
                <Progress value={avgAtsScore} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Optimization Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.optimizationImpact && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      +
                      {data.optimizationImpact.improvement.percentageImprovement.toFixed(
                        1,
                      )}
                      %
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Performance improvement
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Top Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {data.keywords.slice(0, 4).map(keyword => (
                  <Badge
                    key={keyword.keyword}
                    variant="outline"
                    className={cn(
                      keyword.effectiveness === 'high' &&
                        'border-green-600 text-green-600',
                      keyword.effectiveness === 'medium' &&
                        'border-yellow-600 text-yellow-600',
                    )}
                  >
                    {keyword.keyword}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="comparison">Resume Comparison</TabsTrigger>
            <TabsTrigger value="keywords">Keyword Analysis</TabsTrigger>
            <TabsTrigger value="sections">Section Performance</TabsTrigger>
            <TabsTrigger value="trends">ATS Score Trends</TabsTrigger>
            <TabsTrigger value="optimization">Optimization Impact</TabsTrigger>
            <TabsTrigger value="correlations">Correlations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resume Performance Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Resume Performance Comparison
                  </CardTitle>
                  <CardDescription>
                    Success metrics across all resume versions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.resumes}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.5}
                      />
                      <XAxis
                        dataKey="resumeName"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{
                          fontSize: 11,
                          fill: 'hsl(var(--muted-foreground))',
                        }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                        labelStyle={{
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Bar
                        dataKey="responseRate"
                        fill="#3b82f6"
                        name="Response Rate %"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="interviewRate"
                        fill="#8b5cf6"
                        name="Interview Rate %"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="offerRate"
                        fill="#10b981"
                        name="Offer Rate %"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* ATS Score vs Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    ATS Score vs Performance
                  </CardTitle>
                  <CardDescription>
                    Correlation between ATS scores and success rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.5}
                      />
                      <XAxis
                        dataKey="atsScore"
                        name="ATS Score"
                        domain={[50, 100]}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        dataKey="responseRate"
                        name="Response Rate %"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip
                        cursor={{
                          strokeDasharray: '3 3',
                          stroke: 'hsl(var(--border))',
                        }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Scatter
                        name="Resumes"
                        data={data.resumes}
                        fill="#3b82f6"
                      >
                        {data.resumes.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.isPersonalBest ? '#10b981' : '#3b82f6'}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Resume Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.resumes.map(resume => (
                <Card key={resume.resumeId} className="relative">
                  {resume.isPersonalBest && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Award className="h-3 w-3 mr-1" />
                        Best Performer
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {resume.resumeName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Applications</p>
                        <p className="font-medium">
                          {resume.totalApplications}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ATS Score</p>
                        <div className="flex items-center gap-1">
                          <p className="font-medium">{resume.atsScore}</p>
                          {getTrendIcon(resume.performanceTrend)}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Response Rate</p>
                        <p className="font-medium text-blue-600">
                          {resume.responseRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Interview Rate</p>
                        <p className="font-medium text-purple-600">
                          {resume.interviewRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-muted-foreground">
                          Optimization Score
                        </span>
                        <span className="text-sm font-medium">
                          {resume.optimizationScore}%
                        </span>
                      </div>
                      <Progress
                        value={resume.optimizationScore}
                        className="h-2"
                      />
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Last used:{' '}
                        {format(new Date(resume.lastUsed), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg response time: {resume.avgResponseTime.toFixed(1)}{' '}
                        days
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resume Version Comparison</CardTitle>
                <CardDescription>
                  Side-by-side comparison of resume performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart
                    data={data.resumes.map(r => ({
                      resume: r.resumeName,
                      'Response Rate': r.responseRate,
                      'Interview Rate': r.interviewRate,
                      'Offer Rate': r.offerRate * 5, // Scale for visibility
                      'ATS Score': r.atsScore / 2, // Scale to match other metrics
                      Optimization: r.optimizationScore / 2,
                    }))}
                  >
                    <PolarGrid
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.5}
                    />
                    <PolarAngleAxis
                      dataKey="resume"
                      tick={{
                        fill: 'hsl(var(--muted-foreground))',
                        fontSize: 11,
                      }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 50]}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    {data.resumes.map((_, index) => (
                      <Radar
                        key={index}
                        name={data.resumes[index].resumeName}
                        dataKey={(value: any) =>
                          value[data.resumes[index].resumeName]
                        }
                        stroke={COLORS[index % COLORS.length]}
                        fill={COLORS[index % COLORS.length]}
                        fillOpacity={0.3}
                      />
                    ))}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keywords" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Keyword Effectiveness Analysis
                </CardTitle>
                <CardDescription>
                  Performance metrics for keywords in your resume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.keywords.map(keyword => (
                    <div
                      key={keyword.keyword}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-[100px]">
                          <p className="font-medium">{keyword.keyword}</p>
                          <p className="text-sm text-muted-foreground">
                            {keyword.frequency}x frequency
                          </p>
                        </div>
                        <Badge
                          className={getEffectivenessColor(
                            keyword.effectiveness,
                          )}
                        >
                          {keyword.effectiveness}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Applications
                          </p>
                          <p className="font-medium">
                            {keyword.applicationCount}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Response
                          </p>
                          <p className="font-medium text-blue-600">
                            {keyword.responseRate.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Interview
                          </p>
                          <p className="font-medium text-purple-600">
                            {keyword.interviewRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resume Section Performance</CardTitle>
                <CardDescription>
                  Analysis of how each section contributes to success
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.sections}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.5}
                    />
                    <XAxis
                      dataKey="section"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Bar
                      dataKey="successRate"
                      fill="#3b82f6"
                      name="Success Rate %"
                      radius={[4, 4, 0, 0]}
                    >
                      {data.sections.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.impact === 'positive'
                              ? '#10b981'
                              : entry.impact === 'negative'
                                ? '#ef4444'
                                : '#6b7280'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 space-y-3">
                  {data.sections.map(section => (
                    <div
                      key={section.section}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{section.section}</p>
                        <p className="text-sm text-muted-foreground">
                          {section.wordCount} words •{' '}
                          {(section.keywordDensity * 100).toFixed(1)}% keyword
                          density
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            getImpactColor(section.impact),
                          )}
                        >
                          {section.impact}
                        </span>
                        {section.impact === 'positive' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {section.impact === 'negative' && (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  ATS Score Trends
                </CardTitle>
                <CardDescription>
                  Track how your ATS scores improve over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.atsTrends}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.5}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={date => format(new Date(date), 'MMM d')}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis
                      domain={[50, 100]}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip
                      labelFormatter={date =>
                        format(new Date(date), 'MMM d, yyyy')
                      }
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-medium text-popover-foreground">
                                {data.resumeName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Score: {data.score}
                              </p>
                              {data.changeFromPrevious && (
                                <p className="text-sm text-muted-foreground">
                                  Change:{' '}
                                  {data.changeFromPrevious > 0 ? '+' : ''}
                                  {data.changeFromPrevious.toFixed(1)}%
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{
                        fill: '#3b82f6',
                        r: 4,
                        strokeWidth: 2,
                        stroke: 'hsl(var(--background))',
                      }}
                      activeDot={{
                        r: 6,
                        stroke: '#3b82f6',
                        strokeWidth: 2,
                        fill: 'hsl(var(--background))',
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optimization" className="space-y-6">
            {data.optimizationImpact && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Before vs After Optimization</CardTitle>
                    <CardDescription>
                      Impact of resume optimization on key metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            metric: 'ATS Score',
                            before:
                              data.optimizationImpact.beforeOptimization
                                .atsScore,
                            after:
                              data.optimizationImpact.afterOptimization
                                .atsScore,
                          },
                          {
                            metric: 'Response Rate',
                            before:
                              data.optimizationImpact.beforeOptimization
                                .responseRate,
                            after:
                              data.optimizationImpact.afterOptimization
                                .responseRate,
                          },
                          {
                            metric: 'Interview Rate',
                            before:
                              data.optimizationImpact.beforeOptimization
                                .interviewRate,
                            after:
                              data.optimizationImpact.afterOptimization
                                .interviewRate,
                          },
                        ]}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          strokeOpacity={0.5}
                        />
                        <XAxis
                          dataKey="metric"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--popover-foreground))',
                          }}
                        />
                        <Bar
                          dataKey="before"
                          fill="#ef4444"
                          name="Before Optimization"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="after"
                          fill="#10b981"
                          name="After Optimization"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Optimization Impact Summary</CardTitle>
                    <CardDescription>
                      Key improvements from resume optimization
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b">
                        <div>
                          <p className="font-medium">ATS Score Improvement</p>
                          <p className="text-sm text-muted-foreground">
                            From{' '}
                            {
                              data.optimizationImpact.beforeOptimization
                                .atsScore
                            }{' '}
                            to{' '}
                            {data.optimizationImpact.afterOptimization.atsScore}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                          <span className="text-xl font-bold text-green-600">
                            +
                            {data.optimizationImpact.improvement.atsScoreChange}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b">
                        <div>
                          <p className="font-medium">Response Rate Boost</p>
                          <p className="text-sm text-muted-foreground">
                            Increased employer responses
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                          <span className="text-xl font-bold text-green-600">
                            +
                            {data.optimizationImpact.improvement.responseRateChange.toFixed(
                              1,
                            )}
                            %
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b">
                        <div>
                          <p className="font-medium">Interview Rate Growth</p>
                          <p className="text-sm text-muted-foreground">
                            More interview invitations
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                          <span className="text-xl font-bold text-green-600">
                            +
                            {data.optimizationImpact.improvement.interviewRateChange.toFixed(
                              1,
                            )}
                            %
                          </span>
                        </div>
                      </div>

                      <Alert className="mt-4">
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription>
                          Overall performance improved by{' '}
                          {data.optimizationImpact.improvement.percentageImprovement.toFixed(
                            1,
                          )}
                          % after optimization
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="correlations" className="space-y-6">
            {data.correlations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Correlation Analysis
                  </CardTitle>
                  <CardDescription>
                    Statistical relationships between resume attributes and
                    success metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(data.correlations).map(([key, value]) => {
                      const labels: Record<string, string> = {
                        atsScoreToResponseRate: 'ATS Score → Response Rate',
                        atsScoreToInterviewRate: 'ATS Score → Interview Rate',
                        lengthToResponseRate: 'Resume Length → Response Rate',
                        keywordCountToSuccessRate:
                          'Keyword Count → Success Rate',
                        optimizationScoreToOfferRate:
                          'Optimization Score → Offer Rate',
                      };

                      const correlation = value as number;
                      const strength = Math.abs(correlation);
                      const isPositive = correlation > 0;

                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between py-3 border-b last:border-0"
                        >
                          <div>
                            <p className="font-medium">{labels[key] || key}</p>
                            <p className="text-sm text-muted-foreground">
                              {strength > 0.7
                                ? 'Strong'
                                : strength > 0.4
                                  ? 'Moderate'
                                  : 'Weak'}{' '}
                              {isPositive ? 'positive' : 'negative'} correlation
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress
                              value={strength * 100}
                              className={cn(
                                'w-24 h-2',
                                isPositive
                                  ? '[&>div]:bg-green-600'
                                  : '[&>div]:bg-red-600',
                              )}
                            />
                            <span
                              className={cn(
                                'font-bold min-w-[50px] text-right',
                                isPositive ? 'text-green-600' : 'text-red-600',
                              )}
                            >
                              {correlation.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Alert className="mt-6">
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Key Insights:</strong>
                      <ul className="mt-2 space-y-1 text-sm">
                        <li>
                          • Higher ATS scores strongly correlate with better
                          response rates (0.82)
                        </li>
                        <li>
                          • Optimization significantly impacts offer rates
                          (0.71)
                        </li>
                        <li>
                          • Keyword optimization shows positive correlation with
                          success (0.68)
                        </li>
                        <li>
                          • Shorter resumes may perform slightly better (-0.23
                          length correlation)
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
