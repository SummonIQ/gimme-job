import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { JobSearchEffectivenessAnalyzer } from '@/lib/analytics/job-search-effectiveness';
import { 
  startOfWeek, 
  startOfMonth, 
  endOfWeek, 
  endOfMonth, 
  subWeeks, 
  subMonths, 
  parseISO 
} from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const analysisType = searchParams.get('type');
    const period = searchParams.get('period') as 'week' | 'month' || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Determine date range
    let dateRange: { start: Date; end: Date };
    if (startDate && endDate) {
      dateRange = {
        start: parseISO(startDate),
        end: parseISO(endDate),
      };
    } else if (period === 'week') {
      const now = new Date();
      dateRange = {
        start: startOfWeek(now),
        end: endOfWeek(now),
      };
    } else {
      const now = new Date();
      dateRange = {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    }

    switch (analysisType) {
      case 'strategies':
        const strategies = await JobSearchEffectivenessAnalyzer.analyzeSearchStrategies(
          user.id,
          dateRange
        );
        return NextResponse.json({ strategies, dateRange });

      case 'timing':
        const timing = await JobSearchEffectivenessAnalyzer.analyzeApplicationTiming(
          user.id,
          dateRange
        );
        return NextResponse.json({ timing, dateRange });

      case 'platforms':
        const platforms = await JobSearchEffectivenessAnalyzer.analyzePlatformROI(
          user.id,
          dateRange
        );
        return NextResponse.json({ platforms, dateRange });

      case 'keywords':
        const keywords = await JobSearchEffectivenessAnalyzer.analyzeKeywordPerformance(
          user.id,
          dateRange
        );
        return NextResponse.json({ keywords, dateRange });

      case 'summary':
        const summary = await JobSearchEffectivenessAnalyzer.generateEffectivenessSummary(
          user.id,
          period
        );
        return NextResponse.json({ summary });

      case 'overview':
      default:
        // Run all analyses for comprehensive overview
        const [allStrategies, allTiming, allPlatforms, allKeywords] = await Promise.all([
          JobSearchEffectivenessAnalyzer.analyzeSearchStrategies(user.id, dateRange),
          JobSearchEffectivenessAnalyzer.analyzeApplicationTiming(user.id, dateRange),
          JobSearchEffectivenessAnalyzer.analyzePlatformROI(user.id, dateRange),
          JobSearchEffectivenessAnalyzer.analyzeKeywordPerformance(user.id, dateRange),
        ]);

        return NextResponse.json({
          overview: {
            strategies: allStrategies.slice(0, 5),
            timing: allTiming.slice(0, 5),
            platforms: allPlatforms.slice(0, 5),
            keywords: allKeywords.slice(0, 10),
          },
          dateRange,
        });
    }
  } catch (error) {
    console.error('Job search effectiveness API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze job search effectiveness' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, dateRange, filters } = body;

    switch (action) {
      case 'compare-periods':
        return await handlePeriodComparison(user.id, body);
      
      case 'export-data':
        return await handleDataExport(user.id, body);
      
      case 'optimize-strategy':
        return await handleStrategyOptimization(user.id, body);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Job search effectiveness POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function handlePeriodComparison(userId: string, body: any) {
  const { currentPeriod, comparisonPeriod } = body;
  
  const currentRange = {
    start: parseISO(currentPeriod.start),
    end: parseISO(currentPeriod.end),
  };
  
  const comparisonRange = {
    start: parseISO(comparisonPeriod.start),
    end: parseISO(comparisonPeriod.end),
  };

  const [currentData, comparisonData] = await Promise.all([
    Promise.all([
      JobSearchEffectivenessAnalyzer.analyzeSearchStrategies(userId, currentRange),
      JobSearchEffectivenessAnalyzer.analyzeApplicationTiming(userId, currentRange),
      JobSearchEffectivenessAnalyzer.analyzePlatformROI(userId, currentRange),
      JobSearchEffectivenessAnalyzer.analyzeKeywordPerformance(userId, currentRange),
    ]),
    Promise.all([
      JobSearchEffectivenessAnalyzer.analyzeSearchStrategies(userId, comparisonRange),
      JobSearchEffectivenessAnalyzer.analyzeApplicationTiming(userId, comparisonRange),
      JobSearchEffectivenessAnalyzer.analyzePlatformROI(userId, comparisonRange),
      JobSearchEffectivenessAnalyzer.analyzeKeywordPerformance(userId, comparisonRange),
    ]),
  ]);

  return NextResponse.json({
    current: {
      strategies: currentData[0],
      timing: currentData[1],
      platforms: currentData[2],
      keywords: currentData[3],
      period: currentRange,
    },
    comparison: {
      strategies: comparisonData[0],
      timing: comparisonData[1],
      platforms: comparisonData[2],
      keywords: comparisonData[3],
      period: comparisonRange,
    },
  });
}

async function handleDataExport(userId: string, body: any) {
  const { format, analysisTypes, dateRange } = body;
  
  const range = {
    start: parseISO(dateRange.start),
    end: parseISO(dateRange.end),
  };

  const exportData: any = {};

  if (analysisTypes.includes('strategies')) {
    exportData.strategies = await JobSearchEffectivenessAnalyzer.analyzeSearchStrategies(userId, range);
  }
  if (analysisTypes.includes('timing')) {
    exportData.timing = await JobSearchEffectivenessAnalyzer.analyzeApplicationTiming(userId, range);
  }
  if (analysisTypes.includes('platforms')) {
    exportData.platforms = await JobSearchEffectivenessAnalyzer.analyzePlatformROI(userId, range);
  }
  if (analysisTypes.includes('keywords')) {
    exportData.keywords = await JobSearchEffectivenessAnalyzer.analyzeKeywordPerformance(userId, range);
  }

  // For now, return JSON data. In a full implementation, you'd generate CSV/Excel files
  return NextResponse.json({
    format,
    data: exportData,
    generatedAt: new Date().toISOString(),
    dateRange: range,
  });
}

async function handleStrategyOptimization(userId: string, body: any) {
  const { currentStrategy, targetMetrics } = body;
  
  // Get current month data for optimization suggestions
  const now = new Date();
  const dateRange = {
    start: startOfMonth(now),
    end: endOfMonth(now),
  };

  const [strategies, timing, platforms, keywords] = await Promise.all([
    JobSearchEffectivenessAnalyzer.analyzeSearchStrategies(userId, dateRange),
    JobSearchEffectivenessAnalyzer.analyzeApplicationTiming(userId, dateRange),
    JobSearchEffectivenessAnalyzer.analyzePlatformROI(userId, dateRange),
    JobSearchEffectivenessAnalyzer.analyzeKeywordPerformance(userId, dateRange),
  ]);

  // Generate optimization recommendations
  const recommendations = [];

  // Strategy recommendations
  const topStrategy = strategies[0];
  if (topStrategy && topStrategy.effectiveness === 'high') {
    recommendations.push({
      type: 'strategy',
      priority: 'high',
      action: `Adopt "${topStrategy.strategy}" approach more frequently`,
      impact: `Potential ${Math.round(topStrategy.successRate)}% success rate`,
      currentPerformance: currentStrategy?.successRate || 0,
      targetPerformance: topStrategy.successRate,
    });
  }

  // Timing recommendations
  const optimalTiming = timing.filter(t => t.recommendation === 'optimal').slice(0, 3);
  for (const slot of optimalTiming) {
    recommendations.push({
      type: 'timing',
      priority: 'medium',
      action: `Schedule more applications during ${slot.timeSlot}`,
      impact: `${Math.round(slot.successRate)}% success rate in this time slot`,
      currentPerformance: 0,
      targetPerformance: slot.successRate,
    });
  }

  // Platform recommendations
  const topPlatforms = platforms.filter(p => p.costEffectiveness === 'excellent').slice(0, 2);
  for (const platform of topPlatforms) {
    recommendations.push({
      type: 'platform',
      priority: 'high',
      action: `Increase focus on ${platform.platform}`,
      impact: `ROI of ${platform.roi.toFixed(1)} with ${platform.successRate.toFixed(1)}% success rate`,
      currentPerformance: 0,
      targetPerformance: platform.successRate,
    });
  }

  // Keyword recommendations
  const expandKeywords = keywords.filter(k => k.optimization === 'expand').slice(0, 3);
  for (const keyword of expandKeywords) {
    recommendations.push({
      type: 'keyword',
      priority: 'medium',
      action: `Use "${keyword.keyword}" in more searches`,
      impact: `${keyword.successRate.toFixed(1)}% success rate with this keyword`,
      currentPerformance: 0,
      targetPerformance: keyword.successRate,
    });
  }

  return NextResponse.json({
    recommendations: recommendations.slice(0, 8),
    currentAnalysis: {
      strategies: strategies.slice(0, 3),
      timing: timing.slice(0, 3),
      platforms: platforms.slice(0, 3),
      keywords: keywords.slice(0, 5),
    },
    optimizationTarget: targetMetrics,
  });
}