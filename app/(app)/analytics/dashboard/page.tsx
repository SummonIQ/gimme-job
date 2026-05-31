import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  Calendar,
  Clock,
  FileText,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Analytics Dashboard | Gimme Job',
  description: 'Comprehensive analytics for your job search journey',
};

const analyticsCards = [
  {
    title: 'Application Analytics',
    description:
      'Track application outcomes, response rates, and conversion metrics',
    icon: BarChart3,
    href: '/analytics/applications',
    metrics: [
      { label: 'Total Applications', value: '156' },
      { label: 'Response Rate', value: '18.5%' },
      { label: 'Interview Rate', value: '12%' },
    ],
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    title: 'Resume Performance',
    description: 'Analyze resume effectiveness and ATS optimization scores',
    icon: FileText,
    href: '/analytics',
    tabValue: 'resumes',
    metrics: [
      { label: 'Active Resumes', value: '8' },
      { label: 'Avg ATS Score', value: '82%' },
      { label: 'Best Performer', value: 'v3' },
    ],
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  {
    title: 'Job Search Insights',
    description: 'Optimize your search strategy with performance data',
    icon: Search,
    href: '/analytics',
    tabValue: 'job-searches',
    metrics: [
      { label: 'Total Searches', value: '127' },
      { label: 'Jobs Found', value: '1,842' },
      { label: 'Success Rate', value: '72%' },
    ],
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
  {
    title: 'Interview Performance',
    description:
      'Track interview success rates and identify areas for improvement',
    icon: Users,
    href: '/analytics',
    tabValue: 'interviews',
    metrics: [
      { label: 'Total Interviews', value: '24' },
      { label: 'Pass Rate', value: '67%' },
      { label: 'Offers', value: '8' },
    ],
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
  },
  {
    title: 'Application Timing',
    description: 'Discover the best times to apply for maximum impact',
    icon: Clock,
    href: '/analytics',
    tabValue: 'timing',
    metrics: [
      { label: 'Best Time', value: '9-10 AM' },
      { label: 'Best Day', value: 'Tuesday' },
      { label: 'Avg Response', value: '48h' },
    ],
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
  },
  {
    title: 'Skills Gap Analysis',
    description:
      'Identify skill gaps and get personalized learning recommendations',
    icon: Brain,
    href: '/analytics',
    tabValue: 'skills',
    metrics: [
      { label: 'Skill Match', value: '68%' },
      { label: 'Top Gap', value: 'AWS' },
      { label: 'Salary Impact', value: '+$25k' },
    ],
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
  },
];

export default function AnalyticsDashboardPage() {
  return (
    <Page name="analytics-dashboard" title="Analytics Dashboard">
      <PageHeader
        title="Analytics Dashboard"
        description="Get comprehensive insights into your job search performance with advanced analytics and data visualization."
      />

      <PageContent>
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Applications
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">+4 from last week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Interview Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">15%</div>
              <p className="text-xs text-muted-foreground">+2.5% improvement</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">Applications sent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Score
              </CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">74%</div>
              <p className="text-xs text-muted-foreground">
                Overall performance
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Sections */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {analyticsCards.map(card => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${card.bgColor}`}>
                      <Icon className={`h-6 w-6 ${card.color}`} />
                    </div>
                    <Link
                      href={
                        card.href +
                        (card.tabValue ? `?tab=${card.tabValue}` : '')
                      }
                    >
                      <Button variant="ghost" size="sm">
                        View
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="mt-4">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {card.metrics.map(metric => (
                      <div key={metric.label}>
                        <p className="text-2xl font-bold">{metric.value}</p>
                        <p className="text-xs text-muted-foreground">
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Insights */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Key Insights & Recommendations</CardTitle>
            <CardDescription>
              Based on your recent activity and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                  Strong Performance
                </h4>
                <ul className="space-y-1 text-sm text-green-700 dark:text-green-300">
                  <li>
                    • Your Tuesday applications have 28% higher response rate
                  </li>
                  <li>• Resume v3 is outperforming others by 15%</li>
                  <li>• Interview conversion rate is above industry average</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Areas to Improve
                </h4>
                <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  <li>• Consider adding AWS certification (35% skill gap)</li>
                  <li>
                    • Apply within 24 hours of job posting for better results
                  </li>
                  <li>• Customize resumes more for each application</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
