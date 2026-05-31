import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumes = await db.resume.findMany({
      where: { userId: user.id },
      include: {
        analysis: {
          select: {
            score: true,
            formatting: true,
            grammar: true,
            keywords: true,
            readability: true,
            spelling: true,
            status: true,
          },
        },
        _count: {
          select: {
            revisions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: resumes });
  } catch (error) {
    console.error('Failed to get resumes:', error);
    return NextResponse.json(
      { error: 'Failed to get resumes' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { description, markdown, name, setDefault } = body as {
      description?: string;
      markdown?: string;
      name?: string;
      setDefault?: boolean;
    };

    const parsedName = typeof name === 'string' ? name.trim() : '';
    const parsedMarkdown = typeof markdown === 'string' ? markdown.trim() : '';

    if (!parsedName) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!parsedMarkdown) {
      return NextResponse.json(
        { error: 'markdown is required' },
        { status: 400 },
      );
    }

    const resume = await db.resume.create({
      data: {
        description:
          typeof description === 'string' ? description.trim() : null,
        markdown: parsedMarkdown,
        name: parsedName,
        user: { connect: { id: user.id } },
      },
      select: {
        createdAt: true,
        id: true,
        markdown: true,
        name: true,
        updatedAt: true,
      },
    });

    if (setDefault === true) {
      await db.user.update({
        data: { defaultResumeId: resume.id },
        where: { id: user.id },
      });
    }

    return NextResponse.json(resume, { status: 201 });
  } catch (error) {
    console.error('Failed to create resume:', error);
    return NextResponse.json(
      { error: 'Failed to create resume' },
      { status: 500 },
    );
  }
}
