import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const saveProfileSchema = z.object({
  name: z.string(),
  company: z.string(),
  title: z.string().optional(),
  linkedinUrl: z.string().optional(),
  summary: z.string().optional(),
  experience: z.array(z.string()).optional().default([]),
  education: z.array(z.string()).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  articles: z.array(z.string()).optional().default([]),
  socialProfiles: z.any().optional(),
  personalityData: z.any().optional(),
  interviewStrategy: z.any().optional(),
  researchSources: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  researchedAt: z.string().optional(),
});

// GET - Get all people profiles for the current user
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const profiles = await db.peopleProfile.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        company: true,
        title: true,
        linkedinUrl: true,
        summary: true,
        tags: true,
        researchedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error fetching people profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 },
    );
  }
}

// POST - Save a new people profile (or update if exists)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = saveProfileSchema.parse(body);

    // Check if profile already exists for this user/name/company combination
    const existingProfile = await db.peopleProfile.findFirst({
      where: {
        userId: user.id,
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
        company: {
          equals: data.company,
          mode: 'insensitive',
        },
      },
    });

    let profile;
    if (existingProfile) {
      // Update existing profile instead of creating duplicate
      profile = await db.peopleProfile.update({
        where: {
          id: existingProfile.id,
        },
        data: {
          ...data,
          researchedAt: data.researchedAt ? new Date(data.researchedAt) : null,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new profile
      profile = await db.peopleProfile.create({
        data: {
          ...data,
          userId: user.id,
          researchedAt: data.researchedAt ? new Date(data.researchedAt) : null,
        },
      });
    }

    return NextResponse.json(
      { profile },
      { status: existingProfile ? 200 : 201 },
    );
  } catch (error) {
    console.error('Error saving people profile:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to save profile' },
      { status: 500 },
    );
  }
}
