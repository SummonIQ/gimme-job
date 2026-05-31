'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  Users,
  Building,
  TrendingUp,
  Award,
  Target,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  FileText,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/css';

interface InterviewData {
  totalInterviews: number;
  passRate: number;
  avgDuration: number;
  interviewsByType: Array<{ type: string; count: number; passRate: number }>;
  interviewsByStage: Array<{ stage: string; count: number; passRate: number }>;
  performanceTrend: Array<{
    month: string;
    interviews: number;
    passed: number;
  }>;
  commonQuestions: Array<{
    question: string;
    frequency: number;
    successRate: number;
  }>;
  companyPerformance: Array<{
    company: string;
    interviews: number;
    offers: number;
  }>;
  feedbackSummary: {
    technical: number;
    communication: number;
    cultural: number;
    experience: number;
  };
}

// Mock data
const mockData: InterviewData = {
  totalInterviews: 24,
  passRate: 67,
  avgDuration: 45,
  interviewsByType: [
    { type: 'Phone Screen', count: 24, passRate: 75 },
    { type: 'Technical', count: 18, passRate: 61 },
    { type: 'Behavioral', count: 12, passRate: 83 },
    { type: 'On-site', count: 8, passRate: 50 },
  ],
  interviewsByStage: [
    { stage: 'Initial Screen', count: 24, passRate: 75 },
    { stage: 'Technical Round', count: 18, passRate: 67 },
    { stage: 'Team Interview', count: 12, passRate: 75 },
    { stage: 'Final Round', count: 8, passRate: 63 },
  ],
  performanceTrend: [
    { month: 'Jan', interviews: 3, passed: 2 },
    { month: 'Feb', interviews: 4, passed: 2 },
    { month: 'Mar', interviews: 5, passed: 3 },
    { month: 'Apr', interviews: 4, passed: 3 },
    { month: 'May', interviews: 4, passed: 3 },
    { month: 'Jun', interviews: 4, passed: 3 },
  ],
  commonQuestions: [
    { question: 'Tell me about yourself', frequency: 22, successRate: 82 },
    { question: 'Why this company?', frequency: 20, successRate: 75 },
    { question: 'Biggest challenge faced', frequency: 18, successRate: 78 },
    { question: 'Where do you see yourself', frequency: 15, successRate: 70 },
    { question: 'Salary expectations', frequency: 12, successRate: 58 },
  ],
  companyPerformance: [
    { company: 'Tech Corp', interviews: 3, offers: 1 },
    { company: 'StartupXYZ', interviews: 2, offers: 1 },
    { company: 'Big Finance', interviews: 2, offers: 0 },
    { company: 'Innovation Labs', interviews: 1, offers: 1 },
  ],
  feedbackSummary: {
    technical: 78,
    communication: 85,
    cultural: 72,
    experience: 68,
  },
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function InterviewPerformanceTracker() {
  const [timeRange, setTimeRange] = useState('6m');
  const [selectedTab, setSelectedTab] = useState('overview');

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (rate: number) => {
    if (rate >= 80) return { variant: 'default' as const, text: 'Excellent' };
    if (rate >= 60) return { variant: 'secondary' as const, text: 'Good' };
    return { variant: 'destructive' as const, text: 'Needs Work' };
  };

  return (
    <div className="space-y-6">
      {/* Time Range Filter */}
      <div className="flex items-center justify-end">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">Last month</SelectItem>
            <SelectItem value="3m">Last 3 months</SelectItem>
            <SelectItem value="6m">Last 6 months</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Interviews
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.totalInterviews}</div>
            <p className="text-xs text-muted-foreground">+4 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                getPerformanceColor(mockData.passRate),
              )}
            >
              {mockData.passRate}%
            </div>
            <Progress value={mockData.passRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.avgDuration} min</div>
            <p className="text-xs text-muted-foreground">
              Typical range: 30-60 min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">33%</div>
            <p className="text-xs text-muted-foreground">
              Interviews to offers
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="preparation">Preparation</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Interview Types */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Types & Success Rates</CardTitle>
                <CardDescription>
                  Performance breakdown by interview format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockData.interviewsByType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" name="Count" />
                    <Bar dataKey="passRate" fill="#82ca9d" name="Pass Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Trend</CardTitle>
                <CardDescription>
                  Interview success rate over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockData.performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="interviews"
                      stroke="#8884d8"
                      name="Total Interviews"
                    />
                    <Line
                      type="monotone"
                      dataKey="passed"
                      stroke="#82ca9d"
                      name="Passed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Interview Pipeline */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Pipeline</CardTitle>
                <CardDescription>
                  Success rate at each interview stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockData.interviewsByStage.map((stage, index) => (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            {index + 1}
                          </div>
                          <span className="font-medium">{stage.stage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {stage.count} interviews
                          </Badge>
                          <Badge {...getPerformanceBadge(stage.passRate)}>
                            {stage.passRate}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={stage.passRate} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Company Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Company Success Rate</CardTitle>
                <CardDescription>Interview outcomes by company</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockData.companyPerformance.map(company => (
                    <div
                      key={company.company}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{company.company}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          {company.interviews} interview
                          {company.interviews > 1 ? 's' : ''}
                        </div>
                        {company.offers > 0 ? (
                          <Badge variant="default">
                            {company.offers} offer
                            {company.offers > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No offer</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Skills Assessment</CardTitle>
              <CardDescription>
                Average ratings from interview feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="10%"
                  outerRadius="80%"
                  data={Object.entries(mockData.feedbackSummary).map(
                    ([key, value], index) => ({
                      name: key.charAt(0).toUpperCase() + key.slice(1),
                      value,
                      fill: COLORS[index % COLORS.length],
                    }),
                  )}
                >
                  <RadialBar dataKey="value" />
                  <Legend />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preparation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Common Interview Questions</CardTitle>
              <CardDescription>
                Track your performance on frequently asked questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.commonQuestions.map(q => (
                  <div key={q.question} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{q.question}</p>
                        <p className="text-sm text-muted-foreground">
                          Asked in {q.frequency} interviews
                        </p>
                      </div>
                      <Badge
                        variant={q.successRate >= 70 ? 'default' : 'secondary'}
                      >
                        {q.successRate}% success
                      </Badge>
                    </div>
                    <Progress value={q.successRate} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interview Feedback Summary</CardTitle>
              <CardDescription>
                Key themes from your interview feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                      Strengths
                    </h4>
                    <ul className="space-y-1 text-sm text-green-700 dark:text-green-300">
                      <li>• Strong communication skills</li>
                      <li>• Good problem-solving approach</li>
                      <li>• Enthusiastic and engaged</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      Areas to Improve
                    </h4>
                    <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                      <li>• More specific examples needed</li>
                      <li>• Deeper technical knowledge</li>
                      <li>• Better time management</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
