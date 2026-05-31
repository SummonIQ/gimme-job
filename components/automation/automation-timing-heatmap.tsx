'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimeMetrics } from '@/lib/automation/analytics';

interface Props {
  data: TimeMetrics[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function AutomationTimingHeatmap({ data }: Props) {
  // Create a map for quick lookup
  const heatmapData = new Map<string, TimeMetrics>();
  data.forEach(item => {
    const key = `${item.dayOfWeek}-${item.hour}`;
    heatmapData.set(key, item);
  });

  // Find max submissions for color scaling
  const maxSubmissions = Math.max(...data.map(d => d.submissions), 1);

  const getColor = (submissions: number) => {
    const intensity = submissions / maxSubmissions;
    if (intensity === 0) return 'bg-muted';
    if (intensity < 0.25) return 'bg-blue-200';
    if (intensity < 0.5) return 'bg-blue-400';
    if (intensity < 0.75) return 'bg-blue-600';
    return 'bg-blue-800';
  };

  const getTextColor = (submissions: number) => {
    const intensity = submissions / maxSubmissions;
    return intensity > 0.5 ? 'text-white' : 'text-foreground';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission Timing Heatmap</CardTitle>
        <CardDescription>
          Best times for application visibility based on your success rates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="w-12" /> {/* Spacer for day labels */}
            {HOURS.map(hour => (
              <div
                key={hour}
                className="flex-1 text-xs text-center text-muted-foreground"
              >
                {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
              </div>
            ))}
          </div>
          
          <TooltipProvider>
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex gap-2">
                <div className="w-12 text-sm font-medium flex items-center">
                  {day}
                </div>
                {HOURS.map(hour => {
                  const key = `${dayIndex}-${hour}`;
                  const metrics = heatmapData.get(key);
                  const submissions = metrics?.submissions || 0;
                  const successRate = metrics?.successRate || 0;

                  return (
                    <Tooltip key={hour}>
                      <TooltipTrigger asChild>
                        <div
                          className={`
                            flex-1 aspect-square rounded-sm flex items-center justify-center
                            text-xs font-medium cursor-pointer transition-all
                            hover:ring-2 hover:ring-ring hover:ring-offset-1
                            ${getColor(submissions)} ${getTextColor(submissions)}
                          `}
                        >
                          {submissions > 0 && submissions}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-medium">{day} at {hour}:00</p>
                          <p>Submissions: {submissions}</p>
                          {submissions > 0 && (
                            <p>Success Rate: {successRate.toFixed(1)}%</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </TooltipProvider>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-muted" />
              <span className="text-muted-foreground">No activity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-blue-200" />
              <span className="text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-blue-400" />
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-blue-600" />
              <span className="text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-blue-800" />
              <span className="text-muted-foreground">Peak</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}