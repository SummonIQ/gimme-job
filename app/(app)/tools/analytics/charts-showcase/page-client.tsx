'use client';

import {
  ChartCard,
  COLOR_SCHEMES,
  InteractiveBarChart,
  InteractiveFunnelChart,
  InteractiveLineChart,
  InteractivePieChart,
  InteractiveRadarChart,
  InteractiveScatterChart,
  MetricCard,
} from '@/components/charts/interactive';
import { AccessibleChart } from '@/components/charts/interactive/accessible';
import {
  RealtimeLineChart,
  RealtimeMetrics,
} from '@/components/charts/interactive/realtime';
import {
  ChartCarousel,
  ResponsiveBarChart,
  ResponsiveChartGrid,
  ResponsiveLineChart,
  TouchPieChart,
} from '@/components/charts/interactive/responsive';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';

// Sample data generators
const generateTimeSeriesData = (points: number = 30) => {
  const data = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - points);

  for (let i = 0; i < points; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    data.push({
      date: date.toISOString().split('T')[0],
      applications: Math.floor(Math.random() * 50) + 10,
      responses: Math.floor(Math.random() * 30) + 5,
      interviews: Math.floor(Math.random() * 20) + 2,
      offers: Math.floor(Math.random() * 10) + 1,
    });
  }

  return data;
};

const generateCategoricalData = () => [
  { category: 'LinkedIn', value: 45, responses: 25, interviews: 12 },
  { category: 'Indeed', value: 38, responses: 18, interviews: 8 },
  { category: 'Glassdoor', value: 27, responses: 15, interviews: 6 },
  { category: 'AngelList', value: 22, responses: 12, interviews: 5 },
  { category: 'Direct', value: 18, responses: 10, interviews: 4 },
];

const generatePieData = () => [
  { name: 'Applied', value: 120 },
  { name: 'In Review', value: 45 },
  { name: 'Interview', value: 28 },
  { name: 'Offered', value: 8 },
  { name: 'Rejected', value: 39 },
];

const generateRadarData = () => [
  { skill: 'Technical', you: 85, required: 90, average: 75 },
  { skill: 'Communication', you: 90, required: 85, average: 80 },
  { skill: 'Leadership', you: 75, required: 70, average: 65 },
  { skill: 'Problem Solving', you: 88, required: 85, average: 78 },
  { skill: 'Teamwork', you: 92, required: 90, average: 85 },
  { skill: 'Creativity', you: 78, required: 75, average: 70 },
];

const generateFunnelData = () => [
  { name: 'Job Views', value: 500, fill: '#3b82f6' },
  { name: 'Applications', value: 120, fill: '#10b981' },
  { name: 'Responses', value: 45, fill: '#f59e0b' },
  { name: 'Interviews', value: 28, fill: '#8b5cf6' },
  { name: 'Offers', value: 8, fill: '#ef4444' },
];

const generateScatterData = () => {
  const data = [];
  for (let i = 0; i < 50; i++) {
    data.push({
      atsScore: Math.random() * 100,
      responseRate: Math.random() * 100,
      applications: Math.floor(Math.random() * 50) + 5,
    });
  }
  return data;
};

export default function ChartsShowcasePage() {
  const [timeSeriesData, setTimeSeriesData] = useState(
    generateTimeSeriesData(),
  );
  const [colorScheme, setColorScheme] =
    useState<keyof typeof COLOR_SCHEMES>('default');
  const [accessibilityMode, setAccessibilityMode] = useState(false);

  const refreshData = () => {
    setTimeSeriesData(generateTimeSeriesData());
  };

  // Simulated realtime data source
  const realtimeDataSource = async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
      {
        timestamp: Date.now(),
        value: Math.floor(Math.random() * 100) + 20,
      },
    ];
  };

  const metricsUpdateSource = async () => {
    return [
      {
        id: '1',
        label: 'Total Applications',
        value: Math.floor(Math.random() * 200) + 50,
        unit: 'apps',
        trend: 'up' as const,
      },
      {
        id: '2',
        label: 'Response Rate',
        value: Math.floor(Math.random() * 40) + 20,
        unit: '%',
        trend: 'stable' as const,
      },
      {
        id: '3',
        label: 'Interview Rate',
        value: Math.floor(Math.random() * 20) + 10,
        unit: '%',
        trend: 'up' as const,
      },
      {
        id: '4',
        label: 'Offer Rate',
        value: Math.floor(Math.random() * 10) + 2,
        unit: '%',
        trend: 'down' as const,
      },
    ];
  };

  return (
    <Page name="charts-showcase">
      <PageHeader
        title="Interactive Charts Showcase"
        description="Comprehensive collection of chart components with real-time updates, responsive design, and accessibility features"
        actions={
          <>
            <Select
              value={colorScheme}
              onValueChange={(value: any) => setColorScheme(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Color Scheme" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(COLOR_SCHEMES).map(scheme => (
                  <SelectItem key={scheme} value={scheme}>
                    {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setAccessibilityMode(!accessibilityMode)}
            >
              <Settings className="h-4 w-4" />
              {accessibilityMode ? 'Standard Mode' : 'Accessibility Mode'}
            </Button>
          </>
        }
      />
      <PageContent className="space-y-8">
        {/* Metrics Cards */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Metric Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Applications"
              value="156"
              change={{ value: 12.5, type: 'increase' }}
              description="Last 30 days"
            />
            <MetricCard
              title="Response Rate"
              value="28.4%"
              change={{ value: 3.2, type: 'increase' }}
              description="Above industry average"
            />
            <MetricCard
              title="Interview Rate"
              value="15.8%"
              change={{ value: 1.5, type: 'decrease' }}
              description="Slightly below target"
            />
            <MetricCard
              title="Offer Rate"
              value="5.2%"
              change={{ value: 0.8, type: 'increase' }}
              description="Improving trend"
            />
          </div>
        </div>

        {/* Chart Types Tabs */}
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Charts</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Charts</TabsTrigger>
            <TabsTrigger value="realtime">Real-time</TabsTrigger>
            <TabsTrigger value="responsive">Responsive</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Line Chart */}
              <ChartCard
                title="Application Trends"
                description="30-day application activity"
                action={
                  <Button size="sm" variant="outline" onClick={refreshData}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                }
              >
                <InteractiveLineChart
                  data={timeSeriesData}
                  lines={[
                    {
                      key: 'applications',
                      name: 'Applications',
                      color: COLOR_SCHEMES[colorScheme][0],
                    },
                    {
                      key: 'responses',
                      name: 'Responses',
                      color: COLOR_SCHEMES[colorScheme][1],
                    },
                    {
                      key: 'interviews',
                      name: 'Interviews',
                      color: COLOR_SCHEMES[colorScheme][2],
                    },
                  ]}
                  xAxisKey="date"
                  height={300}
                  showBrush={true}
                  colors={[...COLOR_SCHEMES[colorScheme]]}
                />
              </ChartCard>

              {/* Bar Chart */}
              <ChartCard
                title="Platform Performance"
                description="Applications by platform"
              >
                <InteractiveBarChart
                  data={generateCategoricalData()}
                  bars={[
                    { key: 'value', name: 'Applications' },
                    { key: 'responses', name: 'Responses' },
                    { key: 'interviews', name: 'Interviews' },
                  ]}
                  xAxisKey="category"
                  height={300}
                  stacked={false}
                  colors={[...COLOR_SCHEMES[colorScheme]]}
                />
              </ChartCard>

              {/* Pie Chart */}
              <ChartCard
                title="Application Status Distribution"
                description="Current status breakdown"
              >
                <InteractivePieChart
                  data={generatePieData()}
                  dataKey="value"
                  nameKey="name"
                  height={300}
                  innerRadius={40}
                  colors={[...COLOR_SCHEMES[colorScheme]]}
                />
              </ChartCard>

              {/* Radar Chart */}
              <ChartCard
                title="Skills Assessment"
                description="Your skills vs requirements"
              >
                <InteractiveRadarChart
                  data={generateRadarData()}
                  radars={[
                    { key: 'you', name: 'Your Skills', fillOpacity: 0.3 },
                    { key: 'required', name: 'Required', fillOpacity: 0.2 },
                    {
                      key: 'average',
                      name: 'Average Candidate',
                      fillOpacity: 0.1,
                    },
                  ]}
                  angleKey="skill"
                  height={300}
                  colors={[...COLOR_SCHEMES[colorScheme]]}
                />
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funnel Chart */}
              <ChartCard
                title="Application Funnel"
                description="Conversion through stages"
              >
                <InteractiveFunnelChart
                  data={generateFunnelData()}
                  dataKey="value"
                  nameKey="name"
                  height={300}
                />
              </ChartCard>

              {/* Scatter Plot */}
              <ChartCard
                title="ATS Score vs Response Rate"
                description="Correlation analysis"
              >
                <InteractiveScatterChart
                  data={[]}
                  scatters={[
                    {
                      key: 'main',
                      name: 'Applications',
                      data: generateScatterData(),
                      color: COLOR_SCHEMES[colorScheme][0],
                    },
                  ]}
                  xKey="atsScore"
                  yKey="responseRate"
                  zKey="applications"
                  height={300}
                />
              </ChartCard>

              {/* Stacked Bar Chart */}
              <ChartCard
                title="Monthly Application Breakdown"
                description="Stacked by status"
              >
                <InteractiveBarChart
                  data={generateCategoricalData()}
                  bars={[
                    { key: 'value', name: 'Applications', stackId: 'stack' },
                    { key: 'responses', name: 'Responses', stackId: 'stack' },
                    {
                      key: 'interviews',
                      name: 'Interviews',
                      stackId: 'stack',
                    },
                  ]}
                  xAxisKey="category"
                  height={300}
                  stacked={true}
                  colors={[...COLOR_SCHEMES[colorScheme]]}
                />
              </ChartCard>

              {/* Area Chart */}
              <ChartCard
                title="Cumulative Growth"
                description="Application growth over time"
              >
                <InteractiveLineChart
                  data={timeSeriesData}
                  lines={[
                    { key: 'applications', name: 'Applications' },
                    { key: 'responses', name: 'Responses' },
                  ]}
                  xAxisKey="date"
                  height={300}
                  showArea={true}
                  colors={[...COLOR_SCHEMES[colorScheme]]}
                />
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="realtime" className="space-y-6">
            {/* Real-time Line Chart */}
            <RealtimeLineChart
              title="Live Application Monitoring"
              description="Real-time application submission tracking"
              dataSource={realtimeDataSource}
              updateInterval={2000}
              maxDataPoints={30}
              lines={[{ key: 'value', name: 'Applications per minute' }]}
            />

            {/* Real-time Metrics */}
            <RealtimeMetrics
              title="Live Dashboard Metrics"
              metrics={[
                {
                  id: '1',
                  label: 'Active Applications',
                  value: 42,
                  unit: 'apps',
                  trend: 'up',
                },
                {
                  id: '2',
                  label: "Today's Responses",
                  value: 8,
                  unit: 'responses',
                  trend: 'stable',
                },
                {
                  id: '3',
                  label: 'Pending Reviews',
                  value: 15,
                  unit: 'reviews',
                  trend: 'down',
                },
                {
                  id: '4',
                  label: 'Success Rate',
                  value: 12.5,
                  unit: '%',
                  trend: 'up',
                },
              ]}
              updateInterval={3000}
              onUpdate={metricsUpdateSource}
            />
          </TabsContent>

          <TabsContent value="responsive" className="space-y-6">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                These charts automatically adapt to different screen sizes. Try
                resizing your browser window to see the responsive behavior.
              </p>
            </div>

            {/* Responsive Grid */}
            <ResponsiveChartGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
              <TouchPieChart
                data={generatePieData()}
                dataKey="value"
                nameKey="name"
                title="Touch-Optimized Pie"
                description="Tap segments on mobile"
              />
              <ResponsiveLineChart
                data={timeSeriesData.slice(0, 10)}
                lines={[
                  { key: 'applications', name: 'Applications' },
                  { key: 'responses', name: 'Responses' },
                ]}
                xAxisKey="date"
                title="Responsive Line"
                description="Adapts to screen size"
              />
              <ResponsiveBarChart
                data={generateCategoricalData()}
                bars={[
                  { key: 'value', name: 'Applications' },
                  { key: 'responses', name: 'Responses' },
                ]}
                xAxisKey="category"
                title="Responsive Bar"
                description="Changes orientation on mobile"
              />
            </ResponsiveChartGrid>

            {/* Mobile Carousel */}
            <div className="lg:hidden">
              <h3 className="text-lg font-semibold mb-4">
                Swipeable Chart Carousel (Mobile Only)
              </h3>
              <ChartCarousel
                charts={[
                  <ChartCard key="1" title="Chart 1">
                    <InteractivePieChart
                      data={generatePieData()}
                      dataKey="value"
                      nameKey="name"
                      height={250}
                    />
                  </ChartCard>,
                  <ChartCard key="2" title="Chart 2">
                    <InteractiveBarChart
                      data={generateCategoricalData()}
                      bars={[{ key: 'value', name: 'Applications' }]}
                      xAxisKey="category"
                      height={250}
                    />
                  </ChartCard>,
                  <ChartCard key="3" title="Chart 3">
                    <InteractiveLineChart
                      data={timeSeriesData.slice(0, 10)}
                      lines={[{ key: 'applications', name: 'Applications' }]}
                      xAxisKey="date"
                      height={250}
                    />
                  </ChartCard>,
                ]}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Accessibility Mode Demo */}
        {accessibilityMode && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Accessibility Features</h2>

            <AccessibleChart
              data={timeSeriesData.slice(0, 10)}
              chartType="line"
              chartConfig={{
                lines: [
                  { key: 'applications', name: 'Applications' },
                  { key: 'responses', name: 'Responses' },
                ],
                xAxisKey: 'date',
              }}
              title="Accessible Line Chart"
              description="Toggle between chart and table view with Ctrl+T"
              summaryText="This chart shows application trends over the last 10 days with both applications submitted and responses received."
            />

            <AccessibleChart
              data={generateCategoricalData()}
              chartType="bar"
              chartConfig={{
                bars: [
                  { key: 'value', name: 'Applications' },
                  { key: 'responses', name: 'Responses' },
                ],
                xAxisKey: 'category',
              }}
              title="Accessible Bar Chart"
              description="Platform performance comparison with full keyboard navigation"
            />
          </div>
        )}

        {/* Documentation Section */}
        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h2 className="text-xl font-semibold mb-4">
            Chart Component Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2">🎨 Customization</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Multiple color schemes</li>
                <li>• Configurable dimensions</li>
                <li>• Custom tooltips & labels</li>
                <li>• Animation controls</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">📱 Responsive Design</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Mobile-optimized layouts</li>
                <li>• Touch interactions</li>
                <li>• Adaptive data density</li>
                <li>• Swipeable carousels</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">♿ Accessibility</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Keyboard navigation</li>
                <li>• Screen reader support</li>
                <li>• High contrast modes</li>
                <li>• Data table alternatives</li>
              </ul>
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
