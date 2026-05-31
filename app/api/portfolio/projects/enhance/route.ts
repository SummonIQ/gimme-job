import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { githubPortfolioIntegration } from '@/lib/portfolio/github-integration';
import { db } from '@/lib/db/client';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the project
    const project = await db.portfolioProject.findFirst({
      where: {
        id: projectId,
        portfolio: {
          userId: user.id
        }
      },
      include: {
        portfolio: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Enhance project with README if it has a GitHub URL
    if (project.githubUrl) {
      const enhancedProject = await githubPortfolioIntegration.enhanceProjectWithReadme(projectId);

      // Revalidate cache
      revalidateTag(`portfolio:${project.portfolio.id}`);
      revalidateTag(`project:${projectId}`);

      return NextResponse.json({
        success: true,
        message: 'Project enhanced with README content',
        project: {
          id: enhancedProject.id,
          title: enhancedProject.title,
          description: enhancedProject.description,
          longDescription: enhancedProject.longDescription,
          aiEnhanced: enhancedProject.aiEnhanced
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Project does not have a GitHub URL for enhancement' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Project enhancement failed:', error);

    if (error.message.includes('Invalid GitHub URL')) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL format' },
        { status: 400 }
      );
    }

    if (error.message.includes('GitHub integration not found')) {
      return NextResponse.json(
        { error: 'GitHub integration required for project enhancement' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to enhance project' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      title,
      description,
      shortDescription,
      technologies,
      tags,
      challenges,
      solutions,
      impact,
      demoUrl,
      figmaUrl
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the project
    const existingProject = await db.portfolioProject.findFirst({
      where: {
        id: projectId,
        portfolio: {
          userId: user.id
        }
      },
      include: {
        portfolio: true
      }
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update project with new data
    const updatedProject = await db.portfolioProject.update({
      where: { id: projectId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(shortDescription && { shortDescription }),
        ...(technologies && { technologies }),
        ...(tags && { tags }),
        ...(challenges && { challenges }),
        ...(solutions && { solutions }),
        ...(impact && { impact }),
        ...(demoUrl && { demoUrl }),
        ...(figmaUrl && { figmaUrl })
      }
    });

    // Revalidate cache
    revalidateTag(`portfolio:${existingProject.portfolio.id}`);
    revalidateTag(`project:${projectId}`);

    return NextResponse.json({
      success: true,
      message: 'Project updated successfully',
      project: {
        id: updatedProject.id,
        title: updatedProject.title,
        description: updatedProject.description,
        shortDescription: updatedProject.shortDescription,
        technologies: updatedProject.technologies,
        tags: updatedProject.tags,
        challenges: updatedProject.challenges,
        solutions: updatedProject.solutions,
        impact: updatedProject.impact,
        demoUrl: updatedProject.demoUrl,
        figmaUrl: updatedProject.figmaUrl
      }
    });

  } catch (error) {
    console.error('Project update failed:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}