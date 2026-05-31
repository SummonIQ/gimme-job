"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, subDays, startOfDay } from 'date-fns';

interface JobSearchMetricsProps {
  type?: 'success-rate' | 'search-terms';
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

export function JobSearchMetrics({ type = 'success-rate' }: JobSearchMetricsProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadMetrics();
  }, [type]);

  const loadMetrics = async () => {
    try {
      if (type === 'success-rate') {
        // Load search success rate over time
        const endDate = new Date();
        const startDate = subDays(endDate, 30);
        
        // Mock data for job search success rate
        const timeSeriesData = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          timeSeriesData.push({
            date: format(currentDate, 'MMM dd'),
            searches: Math.floor(Math.random() * 10) + 1,
            leads: Math.floor(Math.random() * 8),
            applications: Math.floor(Math.random() * 5),
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        setData(timeSeriesData);
      } else {
        // Load top search terms
        const searchTerms = [
          { term: 'Software Engineer', count: 45, leads: 32, applications: 18 },
          { term: 'Frontend Developer', count: 38, leads: 25, applications: 12 },
          { term: 'Full Stack Developer', count: 30, leads: 20, applications: 10 },
          { term: 'React Developer', count: 25, leads: 18, applications: 8 },
          { term: 'Senior Engineer', count: 20, leads: 15, applications: 7 },
          { term: 'Remote Developer', count: 18, leads: 12, applications: 5 },
        ];
        
        setData(searchTerms);
      }
    } catch (error) {
      console.error('Failed to load job search metrics:', error);
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

  if (type === 'success-rate') {
    return (
      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={300}>
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
              dataKey="searches" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Searches"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="leads" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Leads"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="applications" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="Applications"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Total Searches</p>
            <p className="text-2xl font-bold text-blue-600">
              {data.reduce((sum: number, day: any) => sum + day.searches, 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Leads Generated</p>
            <p className="text-2xl font-bold text-green-600">
              {data.reduce((sum: number, day: any) => sum + day.leads, 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Applications</p>
            <p className="text-2xl font-bold text-yellow-600">
              {data.reduce((sum: number, day: any) => sum + day.applications, 0)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Search terms view
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {data.map((term: any, index: number) => {
          const conversionRate = term.count > 0 ? ((term.applications / term.count) * 100).toFixed(1) : '0';
          
          return (
            <div key={term.term} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{term.term}</span>
                  <Badge variant="secondary" className="text-xs">
                    {term.count} searches
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {conversionRate}% conversion
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-green-500 to-yellow-500"
                    style={{ width: `${(term.applications / term.count) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{term.leads} leads</span>
                  <span>→</span>
                  <span>{term.applications} apps</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="pt-4 border-t">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Avg. Conversion Rate</p>
            <p className="text-lg font-semibold">
              {(data.reduce((sum: number, term: any) => 
                sum + (term.applications / term.count), 0) / data.length * 100
              ).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Best Performing</p>
            <p className="text-lg font-semibold">
              {data.sort((a: any, b: any) => 
                (b.applications / b.count) - (a.applications / a.count)
              )[0]?.term || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
