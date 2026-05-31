import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { getEnhancedAutomationMetrics } from '@/lib/automation/analytics-enhanced';
import {
  exportAnalytics,
  type ExportFormat,
} from '@/lib/automation/export-analytics';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'csv') as ExportFormat;
    const dateRange = (searchParams.get('range') || 'week') as
      | 'day'
      | 'week'
      | 'month';
    const includeCharts = searchParams.get('includeCharts') === 'true';
    const includeSummary = searchParams.get('includeSummary') !== 'false';
    const includeDetails = searchParams.get('includeDetails') !== 'false';

    // Validate format
    const validFormats: ExportFormat[] = ['csv', 'excel', 'json', 'pdf'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 },
      );
    }

    // Get enhanced metrics
    const metrics = await getEnhancedAutomationMetrics(user.id, dateRange);

    // Export in requested format
    const buffer = await exportAnalytics(metrics, format, {
      dateRange,
      includeCharts,
      includeSummary,
      includeDetails,
    });

    // Set appropriate headers
    const contentType = getContentType(format);
    const fileName = getFileName(format, dateRange);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
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

function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'json':
      return 'application/json';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function getFileName(format: ExportFormat, dateRange: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const extension = format === 'excel' ? 'xlsx' : format;
  return `automation-analytics-${dateRange}-${timestamp}.${extension}`;
}
