"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, TrendingUp, Award, Target } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ResumeMetricsProps {
  type?: 'optimization-scores' | 'top-performing';
}

interface ResumeScore {
  id: string;
  name: string;
  score: number;
  lastOptimized: Date;
  applications: number;
  interviews: number;
}

export function ResumeMetrics({ type = 'optimization-scores' }: ResumeMetricsProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadMetrics();
  }, [type]);

  const loadMetrics = async () => {
    try {
      if (type === 'optimization-scores') {
        // Generate mock optimization score trend data
        const endDate = new Date();
        const startDate = subDays(endDate, 30);
        const trendData = [];
        
        let currentDate = new Date(startDate);
        let score = 65;
        
        while (currentDate <= endDate) {
          // Simulate gradual improvement with some variation
          score = Math.min(95, score + Math.random() * 3 - 0.5);
          trendData.push({
            date: format(currentDate, 'MMM dd'),
            score: Math.round(score),
            keyword: Math.round(score * 0.9),
            formatting: Math.round(score * 1.1),
            content: Math.round(score * 0.95),
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        setData(trendData);
      } else {
        // Top performing resumes
        const resumes: ResumeScore[] = [
          {
            id: '1',
            name: 'Software Engineer - Full Stack',
            score: 92,
            lastOptimized: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            applications: 15,
            interviews: 5,
          },
          {
            id: '2',
            name: 'Senior Frontend Developer',
            score: 88,
            lastOptimized: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            applications: 12,
            interviews: 3,
          },
          {
            id: '3',
            name: 'React Developer - Remote',
            score: 85,
            lastOptimized: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            applications: 8,
            interviews: 2,
          },
          {
            id: '4',
            name: 'Full Stack Engineer - Startup',
            score: 82,
            lastOptimized: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            applications: 10,
            interviews: 2,
          },
        ];
        
        setData(resumes);
      }
    } catch (error) {
      console.error('Failed to load resume metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (type === 'optimization-scores') {
    const latestScore = data[data.length - 1];
    const firstScore = data[0];
    const improvement = latestScore.score - firstScore.score;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Current Score</p>
            <p className="text-2xl font-bold">{latestScore.score}%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Improvement</p>
            <p className="text-2xl font-bold text-green-600">+{improvement}%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Target</p>
            <p className="text-2xl font-bold">95%</p>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="#3b82f6" 
              strokeWidth={3}
              name="Overall Score"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="keyword" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Keywords"
              strokeDasharray="5 5"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="formatting" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="Formatting"
              strokeDasharray="5 5"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="content" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              name="Content"
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Top performing resumes view
  return (
    <div className="space-y-4">
      {data.map((resume: ResumeScore) => {
        const interviewRate = resume.applications > 0 
          ? ((resume.interviews / resume.applications) * 100).toFixed(0)
          : '0';
          
        return (
          <div key={resume.id} className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">{resume.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last optimized {Math.round((Date.now() - resume.lastOptimized.getTime()) / (1000 * 60 * 60 * 24))} days ago
                </p>
              </div>
              <Badge variant={resume.score >= 90 ? 'success' : resume.score >= 80 ? 'warning' : 'secondary'}>
                {resume.score}% Score
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Optimization Score</span>
                <span>{resume.score}%</span>
              </div>
              <Progress value={resume.score} className="h-2" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">Applications</p>
                <p className="font-semibold">{resume.applications}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Interviews</p>
                <p className="font-semibold">{resume.interviews}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Success Rate</p>
                <p className="font-semibold">{interviewRate}%</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
