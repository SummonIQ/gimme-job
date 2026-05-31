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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TreeMap,
  Cell,
  PieChart,
  Pie,
  Sankey,
} from 'recharts';
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  BookOpen,
  Award,
  Briefcase,
  GraduationCap,
  Star,
  Activity,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/css';

interface SkillsGapData {
  skillsComparison: Array<{
    skill: string;
    yourLevel: number;
    marketDemand: number;
    gap: number;
    category: 'technical' | 'soft' | 'domain';
  }>;
  topMissingSkills: Array<{
    skill: string;
    demandPercentage: number;
    avgSalaryImpact: number;
    learningDifficulty: 'easy' | 'medium' | 'hard';
    timeToLearn: string;
  }>;
  skillTrends: Array<{
    month: string;
    emerging: number;
    stable: number;
    declining: number;
  }>;
  industrySkillDemand: Array<{
    industry: string;
    topSkills: Array<{ skill: string; demand: number }>;
    avgSkillMatch: number;
  }>;
  learningRecommendations: Array<{
    skill: string;
    priority: 'high' | 'medium' | 'low';
    resources: Array<{ type: string; name: string; duration: string }>;
    impact: string;
  }>;
  roleSpecificGaps: Array<{
    role: string;
    matchPercentage: number;
    missingSkills: string[];
    transferableSkills: string[];
  }>;
}

// Mock data
const mockData: SkillsGapData = {
  skillsComparison: [
    { skill: 'React', yourLevel: 85, marketDemand: 90, gap: 5, category: 'technical' },
    { skill: 'TypeScript', yourLevel: 70, marketDemand: 85, gap: 15, category: 'technical' },
    { skill: 'Node.js', yourLevel: 60, marketDemand: 80, gap: 20, category: 'technical' },
    { skill: 'AWS', yourLevel: 40, marketDemand: 75, gap: 35, category: 'technical' },
    { skill: 'Docker', yourLevel: 30, marketDemand: 70, gap: 40, category: 'technical' },
    { skill: 'Leadership', yourLevel: 65, marketDemand: 70, gap: 5, category: 'soft' },
    { skill: 'Communication', yourLevel: 80, marketDemand: 85, gap: 5, category: 'soft' },
    { skill: 'Problem Solving', yourLevel: 85, marketDemand: 90, gap: 5, category: 'soft' },
  ],
  topMissingSkills: [
    {
      skill: 'Kubernetes',
      demandPercentage: 68,
      avgSalaryImpact: 15000,
      learningDifficulty: 'hard',
      timeToLearn: '3-6 months',
    },
    {
      skill: 'GraphQL',
      demandPercentage: 52,
      avgSalaryImpact: 8000,
      learningDifficulty: 'medium',
      timeToLearn: '1-2 months',
    },
    {
      skill: 'Next.js',
      demandPercentage: 48,
      avgSalaryImpact: 6000,
      learningDifficulty: 'easy',
      timeToLearn: '2-4 weeks',
    },
    {
      skill: 'Python',
      demandPercentage: 45,
      avgSalaryImpact: 10000,
      learningDifficulty: 'medium',
      timeToLearn: '2-3 months',
    },
    {
      skill: 'Machine Learning',
      demandPercentage: 42,
      avgSalaryImpact: 20000,
      learningDifficulty: 'hard',
      timeToLearn: '6-12 months',
    },
  ],
  skillTrends: [
    { month: 'Jan', emerging: 12, stable: 75, declining: 13 },
    { month: 'Feb', emerging: 15, stable: 73, declining: 12 },
    { month: 'Mar', emerging: 18, stable: 71, declining: 11 },
    { month: 'Apr', emerging: 22, stable: 68, declining: 10 },
    { month: 'May', emerging: 25, stable: 66, declining: 9 },
    { month: 'Jun', emerging: 28, stable: 64, declining: 8 },
  ],
  industrySkillDemand: [
    {
      industry: 'Tech Startups',
      topSkills: [
        { skill: 'React', demand: 92 },
        { skill: 'AWS', demand: 85 },
        { skill: 'Python', demand: 78 },
      ],
      avgSkillMatch: 72,
    },
    {
      industry: 'Enterprise',
      topSkills: [
        { skill: 'Java', demand: 88 },
        { skill: 'Spring', demand: 82 },
        { skill: 'Azure', demand: 76 },
      ],
      avgSkillMatch: 45,
    },
    {
      industry: 'FinTech',
      topSkills: [
        { skill: 'Python', demand: 90 },
        { skill: 'SQL', demand: 88 },
        { skill: 'Security', demand: 85 },
      ],
      avgSkillMatch: 58,
    },
  ],
  learningRecommendations: [
    {
      skill: 'AWS',
      priority: 'high',
      resources: [
        { type: 'Course', name: 'AWS Certified Solutions Architect', duration: '40 hours' },
        { type: 'Practice', name: 'AWS Free Tier Projects', duration: '20 hours' },
        { type: 'Certification', name: 'AWS SAA-C03', duration: '2-3 months' },
      ],
      impact: 'Opens 35% more job opportunities',
    },
    {
      skill: 'Docker',
      priority: 'high',
      resources: [
        { type: 'Course', name: 'Docker Mastery', duration: '20 hours' },
        { type: 'Practice', name: 'Containerize Your Projects', duration: '10 hours' },
        { type: 'Tutorial', name: 'Docker Compose Deep Dive', duration: '5 hours' },
      ],
      impact: 'Required by 70% of DevOps roles',
    },
    {
      skill: 'TypeScript',
      priority: 'medium',
      resources: [
        { type: 'Course', name: 'TypeScript Fundamentals', duration: '15 hours' },
        { type: 'Practice', name: 'Convert JS Project to TS', duration: '20 hours' },
        { type: 'Book', name: 'Effective TypeScript', duration: '10 hours' },
      ],
      impact: 'Improves code quality and team collaboration',
    },
  ],
  roleSpecificGaps: [
    {
      role: 'Senior Frontend Engineer',
      matchPercentage: 78,
      missingSkills: ['Performance Optimization', 'A11y', 'Testing'],
      transferableSkills: ['React', 'JavaScript', 'CSS'],
    },
    {
      role: 'Full Stack Developer',
      matchPercentage: 65,
      missingSkills: ['Backend APIs', 'Database Design', 'DevOps'],
      transferableSkills: ['Frontend', 'Problem Solving', 'Git'],
    },
    {
      role: 'Tech Lead',
      matchPercentage: 58,
      missingSkills: ['Team Management', 'Architecture', 'Mentoring'],
      transferableSkills: ['Technical Skills', 'Communication', 'Planning'],
    },
  ],
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function SkillsGapAnalysis() {
  const [selectedView, setSelectedView] = useState('overview');
  const [selectedIndustry, setSelectedIndustry] = useState('all');

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'hard':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return { variant: 'default' as const, icon: <Zap className="h-3 w-3" /> };
      case 'medium':
        return { variant: 'secondary' as const, icon: <BookOpen className="h-3 w-3" /> };
      case 'hard':
        return { variant: 'outline' as const, icon: <Brain className="h-3 w-3" /> };
      default:
        return { variant: 'outline' as const, icon: null };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/20 border-red-200';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200';
      case 'low':
        return 'bg-green-100 dark:bg-green-900/20 border-green-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Skills Gap Analysis</h3>
          <p className="text-muted-foreground">
            Identify skill gaps and get personalized learning recommendations
          </p>
        </div>
        <Select value={selectedView} onValueChange={setSelectedView}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">Skills Overview</SelectItem>
            <SelectItem value="missing">Missing Skills</SelectItem>
            <SelectItem value="trends">Market Trends</SelectItem>
            <SelectItem value="learning">Learning Path</SelectItem>
            <SelectItem value="roles">Role Analysis</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skill Match</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground">
              vs market requirements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gap Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">32%</div>
            <p className="text-xs text-muted-foreground">
              Skills to develop
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salary Impact</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+$25k</div>
            <p className="text-xs text-muted-foreground">
              Potential increase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Time</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6-9 mo</div>
            <p className="text-xs text-muted-foreground">
              To close top gaps
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {selectedView === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Skills Comparison Radar</CardTitle>
              <CardDescription>
                Your skills vs market demand
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={mockData.skillsComparison}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Your Level"
                    dataKey="yourLevel"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="Market Demand"
                    dataKey="marketDemand"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    fillOpacity={0.6}
                  />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skill Gap Details</CardTitle>
              <CardDescription>
                Prioritized list of skills to develop
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...mockData.skillsComparison]
                  .sort((a, b) => b.gap - a.gap)
                  .map((skill) => (
                    <div key={skill.skill} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {skill.category}
                          </Badge>
                          <span className="font-medium">{skill.skill}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {skill.gap > 20 ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : skill.gap > 10 ? (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <span className={cn(
                            "text-sm font-medium",
                            skill.gap > 20 ? "text-red-600" :
                            skill.gap > 10 ? "text-yellow-600" :
                            "text-green-600"
                          )}>
                            {skill.gap}% gap
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Progress value={skill.yourLevel} className="flex-1" />
                        <span className="text-xs text-muted-foreground w-12">
                          {skill.yourLevel}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'missing' && (
        <Card>
          <CardHeader>
            <CardTitle>Top Missing Skills Analysis</CardTitle>
            <CardDescription>
              High-demand skills you should consider learning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockData.topMissingSkills.map((skill) => {
                const difficultyInfo = getDifficultyBadge(skill.learningDifficulty);
                
                return (
                  <div key={skill.skill} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-lg">{skill.skill}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-muted-foreground">
                            Demanded by {skill.demandPercentage}% of jobs
                          </span>
                          <Badge variant={difficultyInfo.variant} className="gap-1">
                            {difficultyInfo.icon}
                            {skill.learningDifficulty}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">
                          +${skill.avgSalaryImpact.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          avg salary impact
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Time to learn: {skill.timeToLearn}</span>
                      </div>
                      <Button size="sm" variant="outline">
                        View Learning Path
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedView === 'trends' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Skill Market Trends</CardTitle>
              <CardDescription>
                Emerging, stable, and declining skills
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockData.skillTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="emerging"
                    stroke="#00c49f"
                    strokeWidth={2}
                    name="Emerging Skills"
                  />
                  <Line
                    type="monotone"
                    dataKey="stable"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Stable Skills"
                  />
                  <Line
                    type="monotone"
                    dataKey="declining"
                    stroke="#ff8042"
                    strokeWidth={2}
                    name="Declining Skills"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Industry Skill Demand</CardTitle>
              <CardDescription>
                Top skills by industry with your match percentage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.industrySkillDemand.map((industry) => (
                  <div key={industry.industry} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{industry.industry}</h4>
                      <Badge
                        variant={industry.avgSkillMatch > 70 ? 'default' : 'secondary'}
                      >
                        {industry.avgSkillMatch}% match
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {industry.topSkills.map((skill) => (
                        <div
                          key={skill.skill}
                          className="text-sm p-2 bg-muted rounded flex items-center justify-between"
                        >
                          <span>{skill.skill}</span>
                          <span className="text-muted-foreground">{skill.demand}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'learning' && (
        <div className="space-y-6">
          {mockData.learningRecommendations.map((recommendation) => (
            <Card
              key={recommendation.skill}
              className={cn("border-2", getPriorityColor(recommendation.priority))}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{recommendation.skill} Learning Path</CardTitle>
                    <CardDescription>{recommendation.impact}</CardDescription>
                  </div>
                  <Badge
                    variant={
                      recommendation.priority === 'high' ? 'destructive' :
                      recommendation.priority === 'medium' ? 'default' :
                      'secondary'
                    }
                  >
                    {recommendation.priority} priority
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendation.resources.map((resource, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-background border rounded"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded">
                          {resource.type === 'Course' && <BookOpen className="h-4 w-4" />}
                          {resource.type === 'Practice' && <Briefcase className="h-4 w-4" />}
                          {resource.type === 'Certification' && <Award className="h-4 w-4" />}
                          {resource.type === 'Tutorial' && <GraduationCap className="h-4 w-4" />}
                          {resource.type === 'Book' && <BookOpen className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium">{resource.name}</p>
                          <p className="text-sm text-muted-foreground">{resource.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{resource.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedView === 'roles' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {mockData.roleSpecificGaps.map((role) => (
            <Card key={role.role}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{role.role}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Progress value={role.matchPercentage} className="w-24" />
                    <span className="text-sm font-medium">
                      {role.matchPercentage}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Missing Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {role.missingSkills.map((skill) => (
                        <Badge key={skill} variant="destructive">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Transferable Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {role.transferableSkills.map((skill) => (
                        <Badge key={skill} variant="default">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}