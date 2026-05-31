import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { compareResumePerformance } from '@/lib/resumes/performance';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const resumeIds = searchParams.get('resumeIds')?.split(',') || [];
  const revisionIds = searchParams.get('revisionIds')?.split(',') || [];
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (resumeIds.length === 0 && revisionIds.length === 0) {
    return new Response('Must provide resumeIds or revisionIds', { status: 400 });
  }

  try {
    const dateRange = startDate && endDate ? {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    } : undefined;

    const comparison = await compareResumePerformance(
      session.user.id,
      {
        resumeIds: resumeIds.length > 0 ? resumeIds : undefined,
        revisionIds: revisionIds.length > 0 ? revisionIds : undefined,
        dateRange
      }
    );
    
    return Response.json(comparison);
  } catch (error) {
    console.error('Error comparing resume performance:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}