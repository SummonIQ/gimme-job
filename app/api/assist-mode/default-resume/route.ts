import { NextResponse } from 'next/server';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.defaultResumeId) {
    return NextResponse.json(
      { error: 'No default resume available' },
      { status: 404 },
    );
  }

  const resume = await db.resume.findUnique({
    where: { id: user.defaultResumeId },
    include: {
      revisions: {
        where: user.defaultRevisionId
          ? { id: user.defaultRevisionId }
          : undefined,
        orderBy: { createdAt: 'desc' },
        take: user.defaultRevisionId ? 1 : 0,
      },
    },
  });

  const revision = resume?.revisions?.[0];
  const resumeUrl = user.defaultRevisionId
    ? revision?.pdfDocumentUrl || resume?.url
    : resume?.url;
  const fileName = `${user.defaultRevisionId ? revision?.name || resume?.name : resume?.name || 'resume'}.pdf`;

  if (!resumeUrl) {
    return NextResponse.json(
      { error: 'Default resume file is unavailable' },
      { status: 404 },
    );
  }

  const redirectUrl = new URL(resumeUrl);
  redirectUrl.searchParams.set('download', fileName);

  return NextResponse.redirect(redirectUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
