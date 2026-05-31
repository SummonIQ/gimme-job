import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  ScheduledReportsManager,
  validateScheduledReportConfig,
} from '@/lib/exports/scheduled-reports';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

const manager = new ScheduledReportsManager();

// GET - List user's scheduled reports
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const reports = await manager.getUserScheduledReports();
  return NextResponse.json({ reports });
};

export const GET = withApiErrorHandling(handleGET);

// POST - Create a new scheduled report
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      frequency,
      format,
      dataType,
      includeCharts = true,
      includeSummary = true,
      includeDetails = true,
      customFields,
      filters,
      emailRecipients,
      isActive = true,
    } = body;

    // Validate the configuration
    const config = {
      name,
      description,
      frequency,
      format,
      dataType,
      includeCharts,
      includeSummary,
      includeDetails,
      customFields,
      filters,
      emailRecipients,
      isActive,
    };

    const errors = validateScheduledReportConfig(config);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const reportId = await manager.createScheduledReport(config);

    return NextResponse.json({
      success: true,
      reportId,
      message: 'Scheduled report created successfully',
    });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled report' },
      { status: 500 },
    );
  }
}

// PUT - Update a scheduled report
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 },
      );
    }

    // Validate updates if provided
    if (Object.keys(updates).length > 0) {
      const errors = validateScheduledReportConfig(updates);
      if (errors.length > 0) {
        return NextResponse.json(
          { error: 'Validation failed', details: errors },
          { status: 400 },
        );
      }
    }

    await manager.updateScheduledReport(id, updates);

    return NextResponse.json({
      success: true,
      message: 'Scheduled report updated successfully',
    });
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled report' },
      { status: 500 },
    );
  }
}

// DELETE - Delete a scheduled report
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 },
      );
    }

    await manager.deleteScheduledReport(id);

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 },
    );
  }
}
