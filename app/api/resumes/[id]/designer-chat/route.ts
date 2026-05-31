import { generateText } from 'ai';
import { NextResponse } from 'next/server';

import { getModels } from '@/lib/ai/models';
import { getServerAiProvider } from '@/lib/ai/provider';
import { db } from '@/lib/db/client';
import { getStructuredResume } from '@/lib/resumes/structured/actions';
import { STRUCTURED_RESUME_SECTIONS } from '@/lib/resumes/structured/schema';
import { getSessionUser } from '@/lib/user/query';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  activeSection: string;
  messages: ChatMessage[];
}

function buildSystemPrompt(args: {
  activeSection: string;
  resumeName: string;
  contextJson: string;
}): string {
  const sectionMeta = STRUCTURED_RESUME_SECTIONS.find(
    s => s.id === args.activeSection,
  );
  return [
    'You are a friendly, concise resume coach.',
    'Help the user fill out and refine their structured resume.',
    'Ask short, focused questions. Suggest concrete bullet rewrites when asked.',
    'Never invent facts the user has not provided — ask first.',
    `The user is currently focused on the "${sectionMeta?.label ?? args.activeSection}" section.`,
    `Resume name: ${args.resumeName}.`,
    'Current structured resume (JSON):',
    '```json',
    args.contextJson,
    '```',
    'Keep replies under 120 words.',
  ].join('\n');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: resumeId } = await params;

  // Authorize: user owns this resume.
  const owns = await db.resume.findFirst({
    where: { id: resumeId, userId: user.id },
    select: { id: true },
  });
  if (!owns) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json()) as RequestBody;
  if (!body?.messages?.length) {
    return NextResponse.json({ error: 'Missing messages' }, { status: 400 });
  }

  const resume = await getStructuredResume(resumeId);
  if (!resume) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const aiProvider = await getServerAiProvider();
  const model = getModels(aiProvider).fast;

  try {
    const result = await generateText({
      model,
      system: buildSystemPrompt({
        activeSection: body.activeSection,
        resumeName: resume.name,
        contextJson: JSON.stringify(resume.structuredData, null, 2),
      }),
      messages: body.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.4,
    });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to generate a response',
      },
      { status: 500 },
    );
  }
}
