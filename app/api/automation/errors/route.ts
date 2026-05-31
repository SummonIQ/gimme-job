import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { automationErrorHandler } from '@/lib/automation/error-handler';
import { db } from '@/lib/db/client';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('range') || '7days';
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Calculate date range
    let startDate: Date;
    switch (timeRange) {
      case '24hours':
        startDate = subDays(new Date(), 1);
        break;
      case '7days':
        startDate = subDays(new Date(), 7);
        break;
      case '30days':
        startDate = subDays(new Date(), 30);
        break;
      default:
        startDate = subDays(new Date(), 7);
    }

    // Build query filters
    const where: any = {
      userId: user.id,
      action: 'automation_error',
      createdAt: {
        gte: startDate,
      },
    };

    // Fetch error logs from audit log
    const errorLogs = await db.automationAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Transform into error format
    const errors = errorLogs.map(log => {
      const metadata = log.metadata as any;
      return {
        id: metadata.id || log.id,
        timestamp: log.createdAt.toISOString(),
        category: metadata.category || 'unknown',
        severity: metadata.severity || 'medium',
        message: metadata.message || 'Error occurred',
        platform: metadata.context?.platform,
        jobTitle: metadata.context?.metadata?.jobTitle,
        company: metadata.context?.metadata?.company,
        attemptNumber: metadata.context?.attemptNumber,
        resolved: metadata.resolved || false,
        resolvedAt: metadata.resolvedAt,
        resolutionMethod: metadata.resolutionMethod,
        suggestedAction: metadata.resolution?.suggestedAction,
        isRetryable: metadata.resolution?.isRetryable || false,
        requiresUserAction: metadata.resolution?.requiresUserAction || false,
      };
    });

    // Filter by additional criteria if specified
    let filteredErrors = errors;
    
    if (category) {
      filteredErrors = filteredErrors.filter(e => e.category === category);
    }
    
    if (severity) {
      filteredErrors = filteredErrors.filter(e => e.severity === severity);
    }
    
    if (resolved !== null) {
      const isResolved = resolved === 'true';
      filteredErrors = filteredErrors.filter(e => e.resolved === isResolved);
    }

    return NextResponse.json({ 
      errors: filteredErrors,
      total: filteredErrors.length,
      offset,
      limit 
    });
  } catch (error) {
    console.error('Error fetching error logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    );
  }
}