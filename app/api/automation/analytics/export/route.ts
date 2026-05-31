import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { getAutomationMetrics } from '@/lib/automation/analytics';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange =
      (searchParams.get('range') as 'day' | 'week' | 'month') || 'week';

    const metrics = await getAutomationMetrics(session.user.id, dateRange);

    // Create CSV content
    const csvRows = [];

    // Summary section
    csvRows.push(['Automation Analytics Report']);
    csvRows.push(['Generated:', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
    csvRows.push(['Date Range:', dateRange]);
    csvRows.push([]);

    // Key Metrics
    csvRows.push(['Key Metrics']);
    csvRows.push(['Total Automated:', metrics.totalAutomated]);
    csvRows.push(['Total Manual:', metrics.totalManual]);
    csvRows.push(['Success Rate:', `${metrics.successRate.toFixed(2)}%`]);
    csvRows.push(['Failure Rate:', `${metrics.failureRate.toFixed(2)}%`]);
    csvRows.push([
      'Average Processing Time:',
      `${metrics.averageProcessingTime.toFixed(2)} minutes`,
    ]);
    csvRows.push([
      'Time Saved:',
      `${metrics.roiMetrics.totalTimeSaved.toFixed(2)} hours`,
    ]);
    csvRows.push([]);

    // Platform Breakdown
    csvRows.push(['Platform Performance']);
    csvRows.push([
      'Platform',
      'Total Submissions',
      'Success Count',
      'Failure Count',
      'Success Rate',
      'Avg Time (min)',
    ]);
    metrics.platformBreakdown.forEach(platform => {
      csvRows.push([
        platform.platform,
        platform.totalSubmissions,
        platform.successCount,
        platform.failureCount,
        `${platform.successRate.toFixed(2)}%`,
        platform.averageTime.toFixed(2),
      ]);
    });
    csvRows.push([]);

    // Recent Activity
    csvRows.push(['Recent Activity']);
    csvRows.push([
      'Job Title',
      'Company',
      'Platform',
      'Status',
      'Submitted At',
      'Processing Time (min)',
    ]);
    metrics.recentActivity.forEach(activity => {
      csvRows.push([
        activity.jobTitle,
        activity.companyName,
        activity.platform,
        activity.status,
        activity.submittedAt
          ? format(new Date(activity.submittedAt), 'yyyy-MM-dd HH:mm:ss')
          : 'N/A',
        activity.processingTime?.toString() || 'N/A',
      ]);
    });

    // Convert to CSV string
    const csvContent = csvRows
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Return as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="automation-analytics-${dateRange}-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics' },
      { status: 500 },
    );
  }
}
