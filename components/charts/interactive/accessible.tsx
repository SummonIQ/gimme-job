'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  InteractiveLineChart, 
  InteractiveBarChart, 
  InteractivePieChart,
  ChartCard,
  COLOR_SCHEMES 
} from './index';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartBar, Table as TableIcon, Download } from 'lucide-react';
import { cn } from '@/lib/css/tailwind';

// High contrast color schemes for accessibility
export const ACCESSIBLE_COLOR_SCHEMES = {
  highContrast: ['#000000', '#ffffff', '#0066cc', '#ff9900', '#990099', '#00cc00'],
  colorBlind: ['#0173B2', '#DE8F05', '#029E73', '#CC78BC', '#ECE133', '#56B4E9'],
  deuteranopia: ['#0173B2', '#F0E442', '#56B4E9', '#E69F00', '#CC79A7', '#999999'],
  protanopia: ['#0173B2', '#F0E442', '#56B4E9', '#E69F00', '#CC79A7', '#999999'],
  tritanopia: ['#D55E00', '#0072B2', '#CC79A7', '#F0E442', '#009E73', '#999999'],
};

// Accessible chart with data table alternative
interface AccessibleChartProps {
  data: any[];
  chartType: 'line' | 'bar' | 'pie';
  chartConfig: any;
  title: string;
  description?: string;
  summaryText?: string;
}

export function AccessibleChart({
  data,
  chartType,
  chartConfig,
  title,
  description,
  summaryText,
}: AccessibleChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [announcement, setAnnouncement] = useState('');
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Generate summary text for screen readers
  const generateSummary = () => {
    if (summaryText) return summaryText;
    
    switch (chartType) {
      case 'line':
        return `Line chart showing ${title} with ${data.length} data points. ${description || ''}`;
      case 'bar':
        return `Bar chart displaying ${title} with ${data.length} categories. ${description || ''}`;
      case 'pie':
        const total = data.reduce((sum, item) => sum + (item[chartConfig.dataKey] || 0), 0);
        return `Pie chart illustrating ${title} with ${data.length} segments totaling ${total}. ${description || ''}`;
      default:
        return `Chart showing ${title}. ${description || ''}`;
    }
  };

  // Announce changes to screen readers
  const announce = (message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 100);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 't':
      case 'T':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setViewMode(viewMode === 'chart' ? 'table' : 'chart');
          announce(`Switched to ${viewMode === 'chart' ? 'table' : 'chart'} view`);
        }
        break;
    }
  };

  // Render chart based on type
  const renderChart = () => {
    const accessibleColors = ACCESSIBLE_COLOR_SCHEMES.colorBlind;
    
    switch (chartType) {
      case 'line':
        return (
          <InteractiveLineChart
            data={data}
            {...chartConfig}
            colors={accessibleColors}
            aria-label={generateSummary()}
          />
        );
      case 'bar':
        return (
          <InteractiveBarChart
            data={data}
            {...chartConfig}
            colors={accessibleColors}
            aria-label={generateSummary()}
          />
        );
      case 'pie':
        return (
          <InteractivePieChart
            data={data}
            {...chartConfig}
            colors={accessibleColors}
            aria-label={generateSummary()}
          />
        );
      default:
        return null;
    }
  };

  // Render data table
  const renderTable = () => {
    const columns = Object.keys(data[0] || {});
    
    return (
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="font-semibold">
                  {col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1')}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index}>
                {columns.map((col) => (
                  <TableCell key={col}>
                    {typeof row[col] === 'number' 
                      ? row[col].toLocaleString()
                      : row[col]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <ChartCard 
      title={title} 
      description={description}
      action={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'chart' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('chart');
              announce('Switched to chart view');
            }}
            aria-pressed={viewMode === 'chart'}
          >
            <ChartBar className="h-4 w-4 mr-1" />
            Chart
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('table');
              announce('Switched to table view');
            }}
            aria-pressed={viewMode === 'table'}
          >
            <TableIcon className="h-4 w-4 mr-1" />
            Table
          </Button>
        </div>
      }
    >
      <div onKeyDown={handleKeyDown}>
        {/* Screen reader announcement region */}
        <div 
          ref={liveRegionRef}
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </div>

        {/* Chart summary for screen readers */}
        <div className="sr-only" role="region" aria-label="Chart summary">
          <p>{generateSummary()}</p>
        </div>

        {/* Main content */}
        <div role="region" aria-label={`${title} data visualization`}>
          {viewMode === 'chart' ? renderChart() : renderTable()}
        </div>

        {/* Keyboard shortcuts help */}
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Press Ctrl+T to toggle between chart and table view</p>
        </div>
      </div>
    </ChartCard>
  );
}

// Pattern fills for better distinction without color
interface PatternDefsProps {
  patterns: Array<{
    id: string;
    type: 'lines' | 'dots' | 'cross';
    color: string;
  }>;
}

export function PatternDefs({ patterns }: PatternDefsProps) {
  return (
    <defs>
      {patterns.map((pattern) => {
        switch (pattern.type) {
          case 'lines':
            return (
              <pattern
                key={pattern.id}
                id={pattern.id}
                patternUnits="userSpaceOnUse"
                width="4"
                height="4"
              >
                <path
                  d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2"
                  stroke={pattern.color}
                  strokeWidth="1"
                />
              </pattern>
            );
          case 'dots':
            return (
              <pattern
                key={pattern.id}
                id={pattern.id}
                patternUnits="userSpaceOnUse"
                width="4"
                height="4"
              >
                <circle cx="2" cy="2" r="1" fill={pattern.color} />
              </pattern>
            );
          case 'cross':
            return (
              <pattern
                key={pattern.id}
                id={pattern.id}
                patternUnits="userSpaceOnUse"
                width="4"
                height="4"
              >
                <path
                  d="M 0,2 l 4,0 M 2,0 l 0,4"
                  stroke={pattern.color}
                  strokeWidth="0.5"
                />
              </pattern>
            );
          default:
            return null;
        }
      })}
    </defs>
  );
}

// Sonification component for audio representation of data
interface DataSonificationProps {
  data: number[];
  playing?: boolean;
  onPlay?: () => void;
  onStop?: () => void;
}

export function DataSonification({
  data,
  playing = false,
  onPlay,
  onStop,
}: DataSonificationProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playDataAsSound = () => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Map data values to frequencies
    const minFreq = 200;
    const maxFreq = 800;
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);

    let time = ctx.currentTime;
    data.forEach((value, index) => {
      const freq = ((value - minVal) / (maxVal - minVal)) * (maxFreq - minFreq) + minFreq;
      oscillator.frequency.setValueAtTime(freq, time);
      time += 0.1; // 100ms per data point
    });

    oscillator.start();
    oscillator.stop(time);
    oscillatorRef.current = oscillator;

    if (onPlay) onPlay();

    oscillator.onended = () => {
      if (onStop) onStop();
    };
  };

  const stopSound = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current = null;
    }
    if (onStop) onStop();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={playing ? stopSound : playDataAsSound}
        aria-label={playing ? 'Stop data sonification' : 'Play data as sound'}
      >
        {playing ? 'Stop Audio' : 'Play as Audio'}
      </Button>
      <span className="text-xs text-muted-foreground">
        Listen to data trends
      </span>
    </div>
  );
}

// Text description generator for charts
export function generateChartDescription(
  data: any[],
  chartType: string,
  config: any
): string {
  const descriptions: string[] = [];

  switch (chartType) {
    case 'line':
      const trend = detectTrend(data, config.yKey);
      descriptions.push(`The data shows a ${trend} trend.`);
      
      const peaks = findPeaks(data, config.yKey);
      if (peaks.length > 0) {
        descriptions.push(`Peak values occur at: ${peaks.join(', ')}.`);
      }
      break;

    case 'bar':
      const sorted = [...data].sort((a, b) => b[config.dataKey] - a[config.dataKey]);
      descriptions.push(`Highest value: ${sorted[0][config.nameKey]} (${sorted[0][config.dataKey]}).`);
      descriptions.push(`Lowest value: ${sorted[sorted.length - 1][config.nameKey]} (${sorted[sorted.length - 1][config.dataKey]}).`);
      break;

    case 'pie':
      const total = data.reduce((sum, item) => sum + item[config.dataKey], 0);
      const largest = data.reduce((max, item) => 
        item[config.dataKey] > max[config.dataKey] ? item : max
      );
      const percentage = ((largest[config.dataKey] / total) * 100).toFixed(1);
      descriptions.push(`Total: ${total}.`);
      descriptions.push(`Largest segment: ${largest[config.nameKey]} (${percentage}%).`);
      break;
  }

  return descriptions.join(' ');
}

// Helper functions
function detectTrend(data: any[], key: string): string {
  if (data.length < 2) return 'stable';
  
  const first = data[0][key];
  const last = data[data.length - 1][key];
  const middle = data[Math.floor(data.length / 2)][key];
  
  if (last > first && last > middle) return 'increasing';
  if (last < first && last < middle) return 'decreasing';
  return 'variable';
}

function findPeaks(data: any[], key: string): string[] {
  const peaks: string[] = [];
  
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i][key] > data[i - 1][key] && data[i][key] > data[i + 1][key]) {
      peaks.push(data[i].label || `Point ${i}`);
    }
  }
  
  return peaks;
}