import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { withApiErrorHandling, requireAuth, validateQueryParams } from '@/lib/errors/api';
import { JobProvider } from '@/generated/prisma/browser';
import { createAnalyticsPeriod, getUserAnalytics, getApplicationStatusHistory } from '@/lib/analytics';

const applicationAnalyticsQuerySchema = z.object({
  period: z.enum(['30', '90', '180', '365']).optional().default('90'),
});

type ApplicationAnalyticsQuery = z.infer<typeof applicationAnalyticsQuerySchema>;

const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const query = validateQueryParams<ApplicationAnalyticsQuery>(url, applicationAnalyticsQuerySchema);
  
  // Create analytics period from query parameter
  const period = createAnalyticsPeriod(Number(query.period));
  
  // Get analytics data
  const analyticsData = await getUserAnalytics(period);
  
  // Get application status history for trend analysis
  const statusHistory = await getApplicationStatusHistory(period);

  return NextResponse.json({
    data: {
      ...analyticsData,
      statusHistory,
    },
    period: query.period,
  });
};

export const GET = withApiErrorHandling(handleGET);
