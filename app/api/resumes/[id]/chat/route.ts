import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from 'ai';

import { getModels } from '@/lib/ai/models';
import { getServerAiProvider } from '@/lib/ai/provider';
import { db } from '@/lib/db/client';
import { getSessionUser } from '@/lib/user/query';

const SYSTEM_PROMPT = (markdown: string) =>
  `You are a professional resume editor assistant. The user has uploaded their resume and wants to make changes to it.

Here is their current resume in markdown format:

---BEGIN RESUME---
${markdown || '(No resume content available)'}
---END RESUME---

Your job:
1. Help the user edit their resume based on their requests (adding jobs, skills, education, formatting, rewording, etc.)
2. When the user asks for a change, produce the FULL updated resume markdown wrapped in a code block with the language tag \`\`\`resume-markdown
3. Explain what you changed briefly before or after the code block.
4. Keep the existing formatting style consistent.
5. Be concise in your explanations — the user wants results, not essays.
6. If the user asks a question about their resume (not a change), answer it helpfully.
7. ALWAYS preserve all existing content unless the user explicitly asks to remove something.
8. Use professional language and action verbs in resume bullet points.
9. For work history entries, use the format: **Company Name** | Role Title | Date Range, followed by bullet points.
10. For skills, use comma-separated lists grouped by category.

Important: When outputting the updated resume, include the ENTIRE resume with the changes applied, not just the changed section. This ensures nothing is lost when the user applies the changes.`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: resumeId } = await params;

  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId: user.id },
    select: { id: true, markdown: true, name: true },
  });

  if (!resume) {
    return new Response('Resume not found', { status: 404 });
  }

  const { messages } = (await request.json()) as { messages: UIMessage[] };
  const aiProvider = await getServerAiProvider();
  const model = getModels(aiProvider).strong;

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        const result = streamText({
          model,
          system: SYSTEM_PROMPT(resume.markdown ?? ''),
          messages: await convertToModelMessages(messages),
          temperature: 0.3,
        });

        writer.merge(result.toUIMessageStream());
      },
    }),
  });
}
