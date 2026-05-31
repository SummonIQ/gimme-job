import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { getATSScoreTrends } from '@/lib/resumes/performance';
import { withRateLimit } from '@/lib/rate-limit/middleware';

export async function GET(req: NextRequest) {
  // Apply rate limiting for AI resume analysis
  const rateLimitError = await withRateLimit(req, {
    preset: 'aiResumeAnalysis',
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const resumeId = searchParams.get('resumeId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const timeframe = searchParams.get('timeframe') || '90d';

  try {
    const dateRange = startDate && endDate ? {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    } : undefined;

    const trends = await getATSScoreTrends(
      session.user.id,
      {
        resumeId: resumeId || undefined,
        dateRange,
        timeframe
      }
    );
    
    return Response.json(trends);
  } catch (error) {
    console.error('Error getting ATS score trends:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}