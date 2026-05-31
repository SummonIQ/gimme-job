'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Briefcase,
  MapPin,
  DollarSign,
  Building,
  Calendar,
  Activity,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/css';

interface JobSearchPerformanceData {
  totalSearches: number;
  totalJobsFound: number;
  totalApplications: number;
  avgJobsPerSearch: number;
  searchToApplicationRate: number;
  searchSuccessRate: number;
  topSearchTerms: Array<{ term: string; count: number; applications: number }>;
  searchesByPlatform: Array<{ platform: string; searches: number; jobsFound: number }>;
  searchTrends: Array<{ date: string; searches: number; applications: number }>;
  locationPerformance: Array<{ location: string; searches: number; successRate: number }>;
  jobTypePerformance: Array<{ type: string; searches: number; applications: number }>;
  timeToApplication: Array<{ days: string; count: number }>;
}

// Mock data generator
function generateMockData(): JobSearchPerformanceData {
  const trends = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    return {
      date: format(date, 'MMM d'),
      searches: Math.floor(Math.random() * 10) + 2,
      applications: Math.floor(Math.random() * 8),
    };
  });

  return {
    totalSearches: 127,
    totalJobsFound: 1842,
    totalApplications: 89,
    avgJobsPerSearch: 14.5,
    searchToApplicationRate: 4.8,
    searchSuccessRate: 72.4,
    topSearchTerms: [
      { term: 'Software Engineer', count: 34, applications: 23 },
      { term: 'Full Stack Developer', count: 28, applications: 18 },
      { term: 'Frontend Developer', count: 22, applications: 12 },
      { term: 'React Developer', count: 18, applications: 15 },
      { term: 'Senior Engineer', count: 15, applications: 11 },
      { term: 'Remote Developer', count: 10, applications: 10 },
    ],
    searchesByPlatform: [
      { platform: 'Google Jobs', searches: 78, jobsFound: 1234 },
      { platform: 'Indeed', searches: 32, jobsFound: 456 },
      { platform: 'LinkedIn', searches: 17, jobsFound: 152 },
    ],
    searchTrends: trends,
    locationPerformance: [
      { location: 'San Francisco', searches: 45, successRate: 78 },
      { location: 'New York', searches: 32, successRate: 72 },
      { location: 'Remote', searches: 28, successRate: 85 },
      { location: 'Seattle', searches: 12, successRate: 65 },
      { location: 'Austin', searches: 10, successRate: 70 },
    ],
    jobTypePerformance: [
      { type: 'Full-time', searches: 89, applications: 67 },
      { type: 'Contract', searches: 23, applications: 12 },
      { type: 'Part-time', searches: 10, applications: 5 },
      { type: 'Internship', searches: 5, applications: 5 },
    ],
    timeToApplication: [
      { days: 'Same Day', count: 34 },
      { days: '1-3 Days', count: 28 },
      { days: '4-7 Days', count: 18 },
      { days: '1-2 Weeks', count: 9 },
    ],
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function JobSearchPerformanceDashboard() {
  const [timeRange, setTimeRange] = useState('30d');
  const data = useMemo(() => generateMockData(), []);

  const getMetricChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change > 0,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Search Performance Overview</h3>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSearches}</div>
            <div className="flex items-center text-xs">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500">+12.5%</span>
              <span className="text-muted-foreground ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Found</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalJobsFound.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              Avg {data.avgJobsPerSearch} per search
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Application Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.searchToApplicationRate}%</div>
            <Progress value={data.searchToApplicationRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.searchSuccessRate}%</div>
            <div className="text-xs text-muted-foreground">
              Searches with applications
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Search Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Application Trends</CardTitle>
            <CardDescription>
              Daily search activity and resulting applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.searchTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="searches"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                  name="Searches"
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stackId="1"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.6}
                  name="Applications"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Search Terms */}
        <Card>
          <CardHeader>
            <CardTitle>Top Search Terms Performance</CardTitle>
            <CardDescription>
              Most used search terms and their conversion to applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topSearchTerms} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="term" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="Searches" />
                <Bar dataKey="applications" fill="#82ca9d" name="Applications" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Search Platform Effectiveness</CardTitle>
            <CardDescription>
              Compare job discovery across different platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.searchesByPlatform}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ platform, jobsFound }) => `${platform}: ${jobsFound}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="jobsFound"
                >
                  {data.searchesByPlatform.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {data.searchesByPlatform.map((platform, index) => (
                <div key={platform.platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">{platform.platform}</span>
                  </div>
                  <Badge variant="outline">{platform.searches} searches</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Location Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Location Search Performance</CardTitle>
            <CardDescription>
              Success rates by search location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.locationPerformance.map((location) => (
                <div key={location.location} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{location.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{location.searches} searches</Badge>
                      <Badge
                        variant={location.successRate > 75 ? 'default' : 'secondary'}
                      >
                        {location.successRate}% success
                      </Badge>
                    </div>
                  </div>
                  <Progress value={location.successRate} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Job Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Job Type Performance</CardTitle>
            <CardDescription>
              Application rates by job type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={data.jobTypePerformance}>
                <PolarGrid />
                <PolarAngleAxis dataKey="type" />
                <PolarRadiusAxis />
                <Radar
                  name="Applications"
                  dataKey="applications"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Time to Application */}
        <Card>
          <CardHeader>
            <CardTitle>Time to Application</CardTitle>
            <CardDescription>
              How quickly you apply after finding jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.timeToApplication.map((time) => (
                <div key={time.days} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{time.days}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={(time.count / data.totalApplications) * 100}
                      className="w-24"
                    />
                    <span className="text-sm font-medium w-10 text-right">
                      {time.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Search Insights</CardTitle>
            <CardDescription>
              Key findings from your search patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm">
                  <strong>Best performing:</strong> Remote searches have 85% success rate
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm">
                  <strong>Optimization tip:</strong> Try more specific search terms
                </p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm">
                  <strong>Peak time:</strong> Most successful searches on Tuesdays
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}