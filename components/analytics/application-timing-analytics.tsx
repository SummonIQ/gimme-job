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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  HeatMap,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts';
import {
  Clock,
  Calendar,
  TrendingUp,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Target,
  AlertCircle,
  CheckCircle,
  Timer,
  CalendarDays,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/css';

interface ApplicationTimingData {
  bestTimesOfDay: Array<{
    hour: number;
    applications: number;
    responseRate: number;
    avgResponseTime: number;
  }>;
  bestDaysOfWeek: Array<{
    day: string;
    applications: number;
    responseRate: number;
    interviewRate: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    applications: number;
    successRate: number;
    avgCompetition: number;
  }>;
  applicationVelocity: Array<{
    week: string;
    applications: number;
    quality: 'high' | 'medium' | 'low';
    burnoutRisk: number;
  }>;
  responseTimeByPlatform: Array<{
    platform: string;
    avgHours: number;
    bestTime: string;
    worstTime: string;
  }>;
  competitionAnalysis: Array<{
    timeSlot: string;
    avgApplicants: number;
    yourApplications: number;
    successRate: number;
  }>;
}

// Mock data
const mockData: ApplicationTimingData = {
  bestTimesOfDay: [
    { hour: 6, applications: 8, responseRate: 18, avgResponseTime: 24 },
    { hour: 7, applications: 12, responseRate: 22, avgResponseTime: 28 },
    { hour: 8, applications: 23, responseRate: 28, avgResponseTime: 32 },
    { hour: 9, applications: 34, responseRate: 32, avgResponseTime: 36 },
    { hour: 10, applications: 28, responseRate: 30, avgResponseTime: 40 },
    { hour: 11, applications: 25, responseRate: 26, avgResponseTime: 44 },
    { hour: 12, applications: 15, responseRate: 20, avgResponseTime: 48 },
    { hour: 13, applications: 18, responseRate: 22, avgResponseTime: 48 },
    { hour: 14, applications: 22, responseRate: 24, avgResponseTime: 52 },
    { hour: 15, applications: 20, responseRate: 22, avgResponseTime: 56 },
    { hour: 16, applications: 18, responseRate: 20, avgResponseTime: 60 },
    { hour: 17, applications: 14, responseRate: 18, avgResponseTime: 64 },
    { hour: 18, applications: 10, responseRate: 16, avgResponseTime: 68 },
    { hour: 19, applications: 8, responseRate: 14, avgResponseTime: 72 },
    { hour: 20, applications: 12, responseRate: 15, avgResponseTime: 72 },
    { hour: 21, applications: 10, responseRate: 12, avgResponseTime: 76 },
    { hour: 22, applications: 6, responseRate: 10, avgResponseTime: 80 },
  ],
  bestDaysOfWeek: [
    { day: 'Monday', applications: 45, responseRate: 24, interviewRate: 12 },
    { day: 'Tuesday', applications: 52, responseRate: 28, interviewRate: 15 },
    { day: 'Wednesday', applications: 48, responseRate: 26, interviewRate: 14 },
    { day: 'Thursday', applications: 42, responseRate: 22, interviewRate: 11 },
    { day: 'Friday', applications: 35, responseRate: 18, interviewRate: 8 },
    { day: 'Saturday', applications: 12, responseRate: 15, interviewRate: 6 },
    { day: 'Sunday', applications: 18, responseRate: 20, interviewRate: 10 },
  ],
  monthlyTrends: [
    { month: 'Jan', applications: 89, successRate: 22, avgCompetition: 120 },
    { month: 'Feb', applications: 102, successRate: 24, avgCompetition: 115 },
    { month: 'Mar', applications: 118, successRate: 26, avgCompetition: 108 },
    { month: 'Apr', applications: 95, successRate: 20, avgCompetition: 125 },
    { month: 'May', applications: 88, successRate: 18, avgCompetition: 130 },
    { month: 'Jun', applications: 92, successRate: 19, avgCompetition: 128 },
  ],
  applicationVelocity: [
    { week: 'Week 1', applications: 12, quality: 'high', burnoutRisk: 20 },
    { week: 'Week 2', applications: 18, quality: 'high', burnoutRisk: 30 },
    { week: 'Week 3', applications: 25, quality: 'medium', burnoutRisk: 50 },
    { week: 'Week 4', applications: 32, quality: 'medium', burnoutRisk: 70 },
    { week: 'Week 5', applications: 38, quality: 'low', burnoutRisk: 85 },
    { week: 'Week 6', applications: 15, quality: 'high', burnoutRisk: 40 },
  ],
  responseTimeByPlatform: [
    { platform: 'LinkedIn', avgHours: 48, bestTime: '9-10 AM', worstTime: '6-8 PM' },
    { platform: 'Indeed', avgHours: 72, bestTime: '8-9 AM', worstTime: 'Weekends' },
    { platform: 'Company Sites', avgHours: 96, bestTime: 'Tuesday AM', worstTime: 'Friday PM' },
    { platform: 'AngelList', avgHours: 36, bestTime: 'Monday AM', worstTime: 'Thursday PM' },
  ],
  competitionAnalysis: [
    { timeSlot: 'Early Morning (6-9)', avgApplicants: 45, yourApplications: 43, successRate: 28 },
    { timeSlot: 'Morning (9-12)', avgApplicants: 89, yourApplications: 87, successRate: 24 },
    { timeSlot: 'Afternoon (12-3)', avgApplicants: 76, yourApplications: 40, successRate: 20 },
    { timeSlot: 'Late Afternoon (3-6)', avgApplicants: 68, yourApplications: 52, successRate: 22 },
    { timeSlot: 'Evening (6-9)', avgApplicants: 54, yourApplications: 30, successRate: 18 },
  ],
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function ApplicationTimingAnalytics() {
  const [selectedView, setSelectedView] = useState('timeOfDay');
  const [timeRange, setTimeRange] = useState('30d');

  const getTimeIcon = (hour: number) => {
    if (hour >= 6 && hour < 12) return <Sunrise className="h-4 w-4 text-yellow-500" />;
    if (hour >= 12 && hour < 17) return <Sun className="h-4 w-4 text-orange-500" />;
    if (hour >= 17 && hour < 20) return <Sunset className="h-4 w-4 text-orange-600" />;
    return <Moon className="h-4 w-4 text-blue-500" />;
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getBurnoutColor = (risk: number) => {
    if (risk >= 70) return 'bg-red-500';
    if (risk >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Application Timing Analytics</h3>
          <p className="text-muted-foreground">
            Optimize when you apply for maximum impact
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedView} onValueChange={setSelectedView}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeOfDay">Time of Day</SelectItem>
              <SelectItem value="dayOfWeek">Day of Week</SelectItem>
              <SelectItem value="monthly">Monthly Trends</SelectItem>
              <SelectItem value="velocity">Application Velocity</SelectItem>
              <SelectItem value="competition">Competition Analysis</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">9-10 AM</div>
            <p className="text-xs text-muted-foreground">32% response rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Day</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Tuesday</div>
            <p className="text-xs text-muted-foreground">28% response rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">48 hrs</div>
            <p className="text-xs text-muted-foreground">Across all platforms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Competition</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">9-12 PM</div>
            <p className="text-xs text-muted-foreground">89 avg applicants</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {selectedView === 'timeOfDay' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Response Rate by Hour</CardTitle>
              <CardDescription>
                When to apply for the best response rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockData.bestTimesOfDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(hour) => `${hour}:00`}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(hour) => `${hour}:00`}
                    formatter={(value: number, name: string) => {
                      if (name === 'responseRate') return `${value}%`;
                      return value;
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="responseRate"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                    name="Response Rate %"
                  />
                  <Area
                    type="monotone"
                    dataKey="applications"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    fillOpacity={0.6}
                    name="Applications"
                    yAxisId="right"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Application Windows</CardTitle>
              <CardDescription>
                Optimal times based on your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sunrise className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium text-green-800 dark:text-green-200">
                      Early Morning (8-10 AM)
                    </h4>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Highest response rates (28-32%). Your application is among the first
                    recruiters see when they start their day.
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sun className="h-5 w-5 text-yellow-600" />
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                      Late Morning (10 AM-12 PM)
                    </h4>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Good response rates (24-26%) but higher competition. Consider
                    applying to priority positions during this time.
                  </p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Moon className="h-5 w-5 text-red-600" />
                    <h4 className="font-medium text-red-800 dark:text-red-200">
                      Evening (After 6 PM)
                    </h4>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Lower response rates (10-16%). Applications may get buried
                    under morning submissions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'dayOfWeek' && (
        <Card>
          <CardHeader>
            <CardTitle>Performance by Day of Week</CardTitle>
            <CardDescription>
              Application success rates throughout the week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={mockData.bestDaysOfWeek}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="responseRate" fill="#8884d8" name="Response Rate %" />
                <Bar dataKey="interviewRate" fill="#82ca9d" name="Interview Rate %" />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-medium">Weekly Insights</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Most Applications</span>
                    <Badge>Tuesday (52)</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Best Response Rate</span>
                    <Badge variant="default">Tuesday (28%)</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Least Competition</span>
                    <Badge variant="secondary">Sunday</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Recommendations</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Focus applications on Monday-Wednesday</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>Avoid Friday afternoons unless urgent</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Sunday applications face less competition</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedView === 'monthly' && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Application Trends</CardTitle>
            <CardDescription>
              Seasonal patterns in job applications and success rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={mockData.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="applications"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Applications"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgCompetition"
                  stroke="#ff8042"
                  strokeWidth={2}
                  name="Avg Competition"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="successRate"
                  stroke="#00c49f"
                  strokeWidth={2}
                  name="Success Rate %"
                />
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                Seasonal Patterns Detected
              </h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• Q1 (Jan-Mar): Higher success rates, increasing competition</li>
                <li>• Q2 (Apr-Jun): More competition, lower success rates</li>
                <li>• Best months: February-March (24-26% success rate)</li>
                <li>• Most competitive: May (130 avg applicants per job)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedView === 'velocity' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Application Velocity & Quality</CardTitle>
              <CardDescription>
                Balance quantity with quality to avoid burnout
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.applicationVelocity.map((week) => (
                  <div key={week.week} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{week.week}</p>
                        <p className="text-sm text-muted-foreground">
                          {week.applications} applications
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            week.quality === 'high'
                              ? 'default'
                              : week.quality === 'medium'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {week.quality} quality
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Burnout Risk</span>
                        <span className={cn(
                          week.burnoutRisk >= 70 ? 'text-red-600' :
                          week.burnoutRisk >= 50 ? 'text-yellow-600' :
                          'text-green-600'
                        )}>
                          {week.burnoutRisk}%
                        </span>
                      </div>
                      <Progress
                        value={week.burnoutRisk}
                        className={cn("h-2", getBurnoutColor(week.burnoutRisk))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Optimal Application Pace</CardTitle>
              <CardDescription>
                Recommendations based on your patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    Sweet Spot: 15-20 applications/week
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Maintains high quality while achieving good volume. Your
                    success rate is highest in this range.
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Warning Signs
                  </h4>
                  <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                    <li>• Quality drops after 25 applications/week</li>
                    <li>• Response rates decrease by 40% when rushed</li>
                    <li>• Take breaks to maintain effectiveness</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'competition' && (
        <Card>
          <CardHeader>
            <CardTitle>Competition Analysis by Time Slot</CardTitle>
            <CardDescription>
              Understanding when you face the most competition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={mockData.competitionAnalysis} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="timeSlot" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgApplicants" fill="#ff8042" name="Avg Applicants" />
                <Bar dataKey="yourApplications" fill="#8884d8" name="Your Applications" />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 space-y-4">
              <h4 className="font-medium">Platform Response Times</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {mockData.responseTimeByPlatform.map((platform) => (
                  <div key={platform.platform} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{platform.platform}</span>
                      <Badge variant="outline">{platform.avgHours}h avg</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Best time:</span>
                        <span className="text-green-600">{platform.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avoid:</span>
                        <span className="text-red-600">{platform.worstTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}