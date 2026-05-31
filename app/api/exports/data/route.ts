import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import {
  exportUserData,
  getContentType,
  getFileName,
  type ExportFormat,
  type DataType,
} from '@/lib/exports/data-exporter';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'csv') as ExportFormat;
    const dataType = (searchParams.get('type') || 'applications') as DataType;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeCharts = searchParams.get('includeCharts') === 'true';
    const includeSummary = searchParams.get('includeSummary') !== 'false';
    const includeDetails = searchParams.get('includeDetails') !== 'false';
    const customFields = searchParams
      .get('customFields')
      ?.split(',')
      .filter(Boolean);

    // Validate format
    const validFormats: ExportFormat[] = ['csv', 'excel', 'json', 'pdf'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate data type
    const validDataTypes: DataType[] = [
      'applications',
      'job-searches',
      'resumes',
      'interviews',
      'combined',
    ];
    if (!validDataTypes.includes(dataType)) {
      return NextResponse.json(
        {
          error: `Invalid data type. Must be one of: ${validDataTypes.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Parse date range
    let dateRange;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
          { status: 400 },
        );
      }

      if (start > end) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 },
        );
      }

      dateRange = { start, end };
    }

    // Parse filters
    const filters: Record<string, any> = {};
    const status = searchParams.get('status');
    const jobProvider = searchParams.get('jobProvider');

    if (status) filters.status = status;
    if (jobProvider) filters.jobProvider = jobProvider;

    // Export data
    const buffer = await exportUserData({
      format,
      dataType,
      dateRange,
      includeCharts,
      includeSummary,
      includeDetails,
      customFields,
      filters,
    });

    // Set appropriate headers
    const contentType = getContentType(format);
    const fileName = getFileName(format, dataType, dateRange);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data. Please try again.' },
      { status: 500 },
    );
  }
}

// POST endpoint for custom report generation
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      format,
      dataType,
      dateRange,
      includeCharts = true,
      includeSummary = true,
      includeDetails = true,
      customFields,
      filters,
      reportName,
    } = body;

    // Validate required fields
    if (!format || !dataType) {
      return NextResponse.json(
        { error: 'Format and data type are required' },
        { status: 400 },
      );
    }

    // Validate format
    const validFormats: ExportFormat[] = ['csv', 'excel', 'json', 'pdf'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate data type
    const validDataTypes: DataType[] = [
      'applications',
      'job-searches',
      'resumes',
      'interviews',
      'combined',
    ];
    if (!validDataTypes.includes(dataType)) {
      return NextResponse.json(
        {
          error: `Invalid data type. Must be one of: ${validDataTypes.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Parse date range
    let parsedDateRange;
    if (dateRange) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use ISO 8601 format' },
          { status: 400 },
        );
      }

      parsedDateRange = { start, end };
    }

    // Export data
    const buffer = await exportUserData({
      format,
      dataType,
      dateRange: parsedDateRange,
      includeCharts,
      includeSummary,
      includeDetails,
      customFields,
      filters,
    });

    // Set appropriate headers
    const contentType = getContentType(format);
    const fileName = reportName
      ? `${reportName.replace(/[^a-zA-Z0-9-_]/g, '_')}.${format === 'excel' ? 'xlsx' : format}`
      : getFileName(format, dataType, parsedDateRange);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Error exporting custom report:', error);
    return NextResponse.json(
      { error: 'Failed to generate custom report. Please try again.' },
      { status: 500 },
    );
  }
}
