import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { multiPlatformManager } from '@/lib/automation/multi-platform-manager';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobLeadIds, concurrency = 3 } = await request.json();

    if (!jobLeadIds || !Array.isArray(jobLeadIds) || jobLeadIds.length === 0) {
      return NextResponse.json(
        { error: 'Job lead IDs are required' },
        { status: 400 }
      );
    }

    // Load user's platform configurations
    await multiPlatformManager.loadUserConfigs(user.id);

    // Submit applications using multi-platform manager
    const results = await multiPlatformManager.batchSubmitApplications(
      jobLeadIds,
      user.id,
      concurrency
    );

    // Calculate summary statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const averageProcessingTime = totalProcessingTime / results.length;

    const summary = {
      totalSubmissions: results.length,
      successful,
      failed,
      successRate: (successful / results.length) * 100,
      averageProcessingTime,
      totalProcessingTime,
    };

    return NextResponse.json({
      message: `Processed ${results.length} applications`,
      summary,
      results: results.map(result => ({
        success: result.success,
        applicationId: result.applicationId,
        platform: result.platform,
        processingTime: result.processingTime,
        errorMessage: result.errorMessage,
      })),
    });
  } catch (error) {
    console.error('Failed to submit workflow applications:', error);
    return NextResponse.json(
      { error: 'Failed to submit applications' },
      { status: 500 }
    );
  }
}