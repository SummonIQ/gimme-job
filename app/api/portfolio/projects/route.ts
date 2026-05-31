import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Portfolio ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the portfolio
    const portfolio = await db.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id
      }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Get projects with related data
    const projects = await db.portfolioProject.findMany({
      where: { portfolioId },
      include: {
        documentationAssets: {
          select: { id: true, fileType: true }
        },
        codeSnippets: {
          select: { id: true, language: true }
        },
        testimonials: {
          select: { id: true, rating: true }
        },
        _count: {
          select: {
            documentationAssets: true,
            codeSnippets: true,
            testimonials: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    const projectsWithStats = projects.map(project => ({
      id: project.id,
      title: project.title,
      description: project.description,
      shortDescription: project.shortDescription,
      type: project.type,
      status: project.status,
      slug: project.slug,
      order: project.order,
      technologies: project.technologies,
      tags: project.tags,
      challenges: project.challenges,
      solutions: project.solutions,
      impact: project.impact,
      thumbnailUrl: project.thumbnailUrl,
      imageUrls: project.imageUrls,
      videoUrl: project.videoUrl,
      demoUrl: project.demoUrl,
      githubUrl: project.githubUrl,
      figmaUrl: project.figmaUrl,
      startDate: project.startDate,
      endDate: project.endDate,
      duration: project.duration,
      client: project.client,
      teamSize: project.teamSize,
      role: project.role,
      metrics: project.metrics,
      aiEnhanced: project.aiEnhanced,
      caseStudyGenerated: project.caseStudyGenerated,
      viewCount: project.viewCount,
      clickCount: project.clickCount,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      // Stats
      assetCount: project._count.documentationAssets,
      codeSnippetCount: project._count.codeSnippets,
      testimonialCount: project._count.testimonials,
      averageRating: project.testimonials.length > 0
        ? project.testimonials.reduce((sum, t) => sum + (t.rating || 0), 0) / project.testimonials.length
        : null,
      // Asset breakdown
      imageAssets: project.documentationAssets.filter(asset => asset.fileType === 'image').length,
      videoAssets: project.documentationAssets.filter(asset => asset.fileType === 'video').length,
      documentAssets: project.documentationAssets.filter(asset => asset.fileType === 'document').length,
      // Technology breakdown
      languages: project.codeSnippets.map(snippet => snippet.language).filter((lang, index, arr) => arr.indexOf(lang) === index)
    }));

    return NextResponse.json({
      success: true,
      projects: projectsWithStats,
      portfolio: {
        id: portfolio.id,
        title: portfolio.title,
        status: portfolio.status
      }
    });

  } catch (error) {
    console.error('Failed to fetch portfolio projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      portfolioId,
      title,
      description,
      shortDescription,
      type = 'CODE_PROJECT',
      technologies = [],
      tags = [],
      githubUrl,
      demoUrl,
      figmaUrl
    } = body;

    if (!portfolioId || !title || !description) {
      return NextResponse.json(
        { error: 'Portfolio ID, title, and description are required' },
        { status: 400 }
      );
    }

    // Verify user owns the portfolio
    const portfolio = await db.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id
      }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Get the next order number
    const lastProject = await db.portfolioProject.findFirst({
      where: { portfolioId },
      orderBy: { order: 'desc' }
    });

    const nextOrder = (lastProject?.order || -1) + 1;

    // Generate unique slug
    let slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    let slugSuffix = 0;
    let finalSlug = slug;

    while (await db.portfolioProject.findFirst({
      where: { portfolioId, slug: finalSlug }
    })) {
      slugSuffix++;
      finalSlug = `${slug}-${slugSuffix}`;
    }

    // Create the project
    const project = await db.portfolioProject.create({
      data: {
        portfolioId,
        title,
        description,
        shortDescription,
        type,
        slug: finalSlug,
        order: nextOrder,
        technologies,
        tags,
        githubUrl,
        demoUrl,
        figmaUrl,
        status: 'DRAFT'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Project created successfully',
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        slug: project.slug,
        type: project.type,
        status: project.status,
        technologies: project.technologies,
        tags: project.tags
      }
    });

  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}