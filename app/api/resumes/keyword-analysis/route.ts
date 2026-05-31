import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { analyzeKeywordEffectiveness } from '@/lib/resumes/keyword-analysis';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const resumeId = searchParams.get('resumeId');
  const resumeRevisionId = searchParams.get('resumeRevisionId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const minApplications = parseInt(searchParams.get('minApplications') || '5');

  try {
    const dateRange = startDate && endDate ? {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    } : undefined;

    const analysis = await analyzeKeywordEffectiveness(
      session.user.id,
      {
        resumeId: resumeId || undefined,
        resumeRevisionId: resumeRevisionId || undefined,
        dateRange,
        minApplications
      }
    );
    
    return Response.json(analysis);
  } catch (error) {
    console.error('Error analyzing keyword effectiveness:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}