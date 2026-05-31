import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { getEnhancedAutomationMetrics } from '@/lib/automation/analytics-enhanced';
import { db } from '@/lib/db/client';

// export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  });

  // Send initial data
  const sendUpdate = async () => {
    try {
      const dateRange = (request.nextUrl.searchParams.get('range') || 'week') as 'day' | 'week' | 'month';
      const metrics = await getEnhancedAutomationMetrics(user.id, dateRange);
      
      // Send as SSE format
      const data = JSON.stringify({
        type: 'metrics-update',
        timestamp: new Date().toISOString(),
        metrics: {
          totalAutomated: metrics.totalAutomated,
          totalManual: metrics.totalManual,
          successRate: metrics.successRate,
          failureRate: metrics.failureRate,
          pendingCount: metrics.pendingCount,
          averageProcessingTime: metrics.averageProcessingTime,
          recentActivity: metrics.recentActivity.slice(0, 5),
          alerts: metrics.alerts,
          platformComparison: metrics.platformComparison,
          performanceMetrics: metrics.performanceMetrics,
          roiMetrics: {
            totalTimeSaved: metrics.roiMetrics.totalTimeSaved,
            dollarValueSaved: metrics.roiMetrics.dollarValueSaved,
            applicationsPerHour: metrics.roiMetrics.applicationsPerHour,
          },
        },
      });
      
      await writer.write(encoder.encode(`data: ${data}\n\n`));
    } catch (error) {
      console.error('Error sending update:', error);
      await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Failed to fetch metrics' })}\n\n`));
    }
  };

  // Send heartbeat to keep connection alive
  const sendHeartbeat = async () => {
    try {
      await writer.write(encoder.encode(': heartbeat\n\n'));
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  };

  // Initial update
  sendUpdate();

  // Set up intervals
  const updateInterval = setInterval(sendUpdate, 30000); // Update every 30 seconds
  const heartbeatInterval = setInterval(sendHeartbeat, 15000); // Heartbeat every 15 seconds

  // Clean up on disconnect
  request.signal.addEventListener('abort', () => {
    clearInterval(updateInterval);
    clearInterval(heartbeatInterval);
    writer.close();
  });

  // Monitor for new submissions and send real-time updates
  const monitorSubmissions = async () => {
    let lastCheckTime = new Date();
    
    const checkInterval = setInterval(async () => {
      try {
        // Check for new submissions since last check
        const newSubmissions = await db.applicationSubmission.count({
          where: {
            userId: user.id,
            createdAt: {
              gt: lastCheckTime,
            },
          },
        });

        if (newSubmissions > 0) {
          // Send immediate update if there are new submissions
          await sendUpdate();
          
          // Send notification event
          const notificationData = JSON.stringify({
            type: 'new-submission',
            timestamp: new Date().toISOString(),
            count: newSubmissions,
          });
          await writer.write(encoder.encode(`event: notification\ndata: ${notificationData}\n\n`));
        }

        lastCheckTime = new Date();
      } catch (error) {
        console.error('Error monitoring submissions:', error);
      }
    }, 5000); // Check every 5 seconds

    request.signal.addEventListener('abort', () => {
      clearInterval(checkInterval);
    });
  };

  monitorSubmissions();

  return new Response(stream.readable, { headers });
}