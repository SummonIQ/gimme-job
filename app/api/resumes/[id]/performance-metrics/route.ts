import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { calculateResumePerformanceMetrics } from '@/lib/resumes/performance';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: resumeId } = params;
  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const includeComparison = searchParams.get('includeComparison') === 'true';

  try {
    const dateRange = startDate && endDate ? {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    } : undefined;

    const metrics = await calculateResumePerformanceMetrics(
      session.user.id,
      {
        resumeId,
        dateRange,
        includeComparison
      }
    );
    
    return Response.json(metrics);
  } catch (error) {
    console.error('Error calculating resume performance metrics:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}