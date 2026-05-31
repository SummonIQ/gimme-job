'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  InteractiveLineChart, 
  InteractiveBarChart, 
  InteractivePieChart,
  InteractiveRadarChart,
  ChartCard,
  MetricCard,
  COLOR_SCHEMES 
} from './index';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/css/tailwind';

// Responsive chart container that adapts to screen size
interface ResponsiveChartContainerProps {
  children: React.ReactNode;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
}

export function ResponsiveChartContainer({
  children,
  className,
  minHeight = 200,
  maxHeight = 500,
}: ResponsiveChartContainerProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        // Calculate height based on aspect ratio and screen size
        let height = width * 0.6; // Default aspect ratio
        
        if (isMobile) {
          height = width * 0.8; // Taller on mobile
        } else if (isTablet) {
          height = width * 0.7; // Medium on tablet
        }
        
        // Apply min/max constraints
        height = Math.max(minHeight, Math.min(height, maxHeight));
        
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isMobile, isTablet, minHeight, maxHeight]);

  return (
    <div 
      ref={containerRef} 
      className={cn('w-full', className)}
      style={{ height: dimensions.height || minHeight }}
    >
      {children}
    </div>
  );
}

// Responsive Line Chart with mobile optimizations
interface ResponsiveLineChartProps {
  data: any[];
  lines: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  xAxisKey: string;
  title: string;
  description?: string;
}

export function ResponsiveLineChart({
  data,
  lines,
  xAxisKey,
  title,
  description,
}: ResponsiveLineChartProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  // Adapt data for mobile - show fewer points
  const adaptedData = isMobile && data.length > 10
    ? data.filter((_, index) => index % Math.ceil(data.length / 10) === 0)
    : data;

  // Simplify line configuration for mobile
  const adaptedLines = isMobile && lines.length > 2
    ? lines.slice(0, 2)
    : lines;

  return (
    <ChartCard title={title} description={description}>
      <ResponsiveChartContainer>
        <InteractiveLineChart
          data={adaptedData}
          lines={adaptedLines}
          xAxisKey={xAxisKey}
          height={isMobile ? 250 : isTablet ? 300 : 350}
          showLegend={!isMobile || lines.length <= 2}
          showGrid={!isMobile}
          margin={{
            top: 5,
            right: isMobile ? 5 : 30,
            left: isMobile ? 5 : 10,
            bottom: isMobile ? 40 : 5,
          }}
        />
      </ResponsiveChartContainer>
    </ChartCard>
  );
}

// Responsive Bar Chart with orientation switching
interface ResponsiveBarChartProps {
  data: any[];
  bars: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  xAxisKey: string;
  title: string;
  description?: string;
  forceOrientation?: 'horizontal' | 'vertical';
}

export function ResponsiveBarChart({
  data,
  bars,
  xAxisKey,
  title,
  description,
  forceOrientation,
}: ResponsiveBarChartProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  // Switch to horizontal layout on mobile for better readability
  const layout = forceOrientation || (isMobile ? 'vertical' : 'horizontal');
  
  // Limit data points on mobile
  const adaptedData = isMobile && data.length > 8
    ? data.slice(0, 8)
    : data;

  return (
    <ChartCard title={title} description={description}>
      <ResponsiveChartContainer>
        <InteractiveBarChart
          data={adaptedData}
          bars={bars}
          xAxisKey={xAxisKey}
          layout={layout}
          height={isMobile ? 250 : isTablet ? 300 : 350}
          showLegend={!isMobile || bars.length <= 2}
          showLabels={!isMobile}
          margin={{
            top: 5,
            right: isMobile ? 5 : 30,
            left: isMobile ? 80 : 10,
            bottom: isMobile ? 40 : 5,
          }}
        />
      </ResponsiveChartContainer>
    </ChartCard>
  );
}

// Responsive Grid Layout for charts
interface ResponsiveChartGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
}

export function ResponsiveChartGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  className,
}: ResponsiveChartGridProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const gridCols = isMobile 
    ? columns.mobile 
    : isTablet 
    ? columns.tablet 
    : columns.desktop;

  return (
    <div 
      className={cn(
        'grid gap-4',
        gridCols === 1 && 'grid-cols-1',
        gridCols === 2 && 'grid-cols-2',
        gridCols === 3 && 'grid-cols-3',
        gridCols === 4 && 'grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}

// Touch-optimized Pie Chart
interface TouchPieChartProps {
  data: any[];
  dataKey: string;
  nameKey: string;
  title: string;
  description?: string;
}

export function TouchPieChart({
  data,
  dataKey,
  nameKey,
  title,
  description,
}: TouchPieChartProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

  const handleSegmentClick = (index: number) => {
    setSelectedSegment(selectedSegment === index ? null : index);
  };

  return (
    <ChartCard title={title} description={description}>
      <ResponsiveChartContainer>
        <div className="relative">
          <InteractivePieChart
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            innerRadius={isMobile ? 30 : 0}
            outerRadius={isMobile ? 70 : 80}
            height={isMobile ? 250 : 300}
            showLabels={!isMobile}
            labelType={isMobile ? 'percent' : 'name'}
          />
          {isMobile && selectedSegment !== null && (
            <div className="absolute top-0 left-0 right-0 bg-background/90 p-2 rounded-md">
              <p className="text-sm font-medium">
                {data[selectedSegment][nameKey]}: {data[selectedSegment][dataKey]}
              </p>
            </div>
          )}
        </div>
      </ResponsiveChartContainer>
    </ChartCard>
  );
}

// Swipeable Chart Carousel for mobile
interface ChartCarouselProps {
  charts: React.ReactNode[];
  className?: string;
}

export function ChartCarousel({ charts, className }: ChartCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < charts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div 
        className="flex transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {charts.map((chart, index) => (
          <div key={index} className="w-full flex-shrink-0">
            {chart}
          </div>
        ))}
      </div>
      
      {/* Indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {charts.map((_, index) => (
          <button
            key={index}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              index === currentIndex ? 'bg-primary' : 'bg-muted'
            )}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to chart ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// Responsive Metrics Dashboard
interface ResponsiveMetricsProps {
  metrics: Array<{
    title: string;
    value: string | number;
    change?: {
      value: number;
      type: 'increase' | 'decrease';
    };
    description?: string;
  }>;
  className?: string;
}

export function ResponsiveMetrics({ metrics, className }: ResponsiveMetricsProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  const columns = isMobile ? 1 : isTablet ? 2 : 4;

  return (
    <div 
      className={cn(
        'grid gap-4',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-2',
        columns === 4 && 'grid-cols-4',
        className
      )}
    >
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}