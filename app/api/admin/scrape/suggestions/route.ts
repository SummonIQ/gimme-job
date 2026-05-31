import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateAIObject } from '@/lib/ai';
import { getServerAiProvider } from '@/lib/ai/provider';
import { isAdminUser } from '@/lib/admin/scrape-service';
import { getCurrentUser } from '@/lib/user/query';

const suggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      category: z.string(),
      terms: z.array(z.string()),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdminUser(user.email))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = (await request.json()) as {
      searchTerm?: string;
      remote?: boolean;
    };

    const searchTerm = body.searchTerm?.trim() || 'software engineer';
    const remote = body.remote ?? false;

    const prompt = `You are a job search expert. Given the search term "${searchTerm}"${remote ? ' (remote positions)' : ''}, suggest related job titles and search terms that would help find similar or adjacent roles on job boards like Google Jobs, Indeed, and USAJobs.

Group them into 4-5 categories. Each category should have 4-6 specific, realistic job titles that employers actually post. Focus on:
- Variations of the exact role (seniority levels, alternate titles)
- Adjacent/related roles someone with this background could also do
- Niche/specialized versions of the role
- Broader searches that would capture this role

Use real job titles, not generic descriptions. Keep terms concise (2-4 words typically).`;

    const aiProvider = await getServerAiProvider();
    const result = await generateAIObject(prompt, suggestionsSchema, {
      aiProvider,
      temperature: 0.8,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 },
    );
  }
}
