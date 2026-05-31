import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { generateAIObject } from '@/lib/ai';
import { getServerAiProvider } from '@/lib/ai/provider';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const fieldAnswerSchema = z.object({
  answers: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser({ include: { profile: true } });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      fields?: Array<{ label: string; placeholder?: string }>;
      jobTitle?: string;
      company?: string;
    };

    if (!body.fields || body.fields.length === 0) {
      return NextResponse.json(
        { error: 'Fields are required' },
        { status: 400 },
      );
    }

    const resume = user.defaultResumeId
      ? await db.resume.findUnique({
          where: { id: user.defaultResumeId },
          include: {
            revisions: {
              where: user.defaultRevisionId
                ? { id: user.defaultRevisionId }
                : undefined,
              orderBy: { createdAt: 'desc' as const },
              take: user.defaultRevisionId ? 1 : 0,
            },
          },
        })
      : null;

    const revision = resume?.revisions?.[0] as {
      markdown?: string | null;
    } | null;
    const resumeMarkdown = revision?.markdown || resume?.markdown || '';

    const profile = user.profile;
    const fullName =
      user.name?.trim() || `${user.firstName} ${user.lastName}`.trim();

    const fieldsDescription = body.fields
      .map(
        (f, i) =>
          `${i + 1}. "${f.label}"${f.placeholder ? ` (placeholder: "${f.placeholder}")` : ''}`,
      )
      .join('\n');

    const prompt = `You are helping a job applicant fill out an application form. Generate concise, professional answers for each field based on their resume and profile.

Applicant: ${fullName}
${body.company ? `Company: ${body.company}` : ''}
${body.jobTitle ? `Job Title: ${body.jobTitle}` : ''}

Resume:
${resumeMarkdown.slice(0, 8000)}

Fields to fill:
${fieldsDescription}

Rules:
- Write in first person as the applicant
- Be specific, reference actual experience from the resume
- Keep answers concise but substantive (2-4 sentences for short answer fields, 3-6 sentences for longer ones)
- Sound natural and genuine, not generic
- If a field asks "why this company", reference the company name and role specifically
- If a field asks about skills, reference specific technologies and accomplishments from the resume`;

    const aiProvider = await getServerAiProvider();
    const result = await generateAIObject(prompt, fieldAnswerSchema, {
      aiProvider,
      temperature: 0.4,
    });

    return NextResponse.json({ answers: result.answers });
  } catch (error) {
    console.error('Assist mode field answers error:', error);
    return NextResponse.json(
      { error: 'Failed to generate field answers' },
      { status: 500 },
    );
  }
}
