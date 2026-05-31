import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { documentationAssistant } from '@/lib/portfolio/documentation-assistant';
import { db } from '@/lib/db/client';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      documentationType = 'readme',
      targetAudience = 'general',
      includeCodeAnalysis = false,
      customPrompt
    } = body;

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
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let result;

    if (documentationType === 'enhance') {
      // Enhance existing project documentation
      result = await documentationAssistant.enhanceProjectDocumentation(projectId, {
        includeCodeAnalysis,
        generateCaseStudy: targetAudience === 'business',
        targetAudience
      });
    } else {
      // Generate specific documentation type
      const documentation = await documentationAssistant.generateDocumentation({
        projectId,
        projectTitle: project.title,
        projectDescription: project.description,
        technologies: project.technologies,
        githubUrl: project.githubUrl || undefined,
        demoUrl: project.demoUrl || undefined,
        targetAudience,
        documentationType
      });

      result = { documentation };
    }

    // Revalidate cache
    revalidateTag(`project:${projectId}`);
    revalidateTag(`portfolio:${project.portfolioId}`);

    return NextResponse.json({
      success: true,
      message: 'Documentation generated successfully',
      documentationType,
      documentation: result.documentation,
      project: result.project ? {
        id: result.project.id,
        title: result.project.title,
        longDescription: result.project.longDescription,
        challenges: result.project.challenges,
        solutions: result.project.solutions,
        impact: result.project.impact,
        caseStudyGenerated: result.project.caseStudyGenerated
      } : undefined
    });

  } catch (error) {
    console.error('Documentation generation failed:', error);

    if (error.message.includes('Project not found')) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (error.message.includes('Failed to generate documentation')) {
      return NextResponse.json(
        { error: 'AI documentation generation failed. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate documentation' },
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
    const { codeSnippetId, generateExplanation } = body;

    if (!codeSnippetId) {
      return NextResponse.json(
        { error: 'Code snippet ID is required' },
        { status: 400 }
      );
    }

    // Get the code snippet
    const codeSnippet = await db.projectCodeSnippet.findFirst({
      where: {
        id: codeSnippetId,
        project: {
          portfolio: {
            userId: user.id
          }
        }
      },
      include: {
        project: true
      }
    });

    if (!codeSnippet) {
      return NextResponse.json({ error: 'Code snippet not found' }, { status: 404 });
    }

    if (generateExplanation) {
      // Generate explanation for the code snippet
      const explanation = await documentationAssistant.generateCodeExplanation(
        codeSnippet.code,
        codeSnippet.language,
        codeSnippet.description || undefined
      );

      // Update the code snippet with the explanation
      const updatedSnippet = await db.projectCodeSnippet.update({
        where: { id: codeSnippetId },
        data: { explanation }
      });

      // Revalidate cache
      revalidateTag(`project:${codeSnippet.project.id}`);

      return NextResponse.json({
        success: true,
        message: 'Code explanation generated successfully',
        codeSnippet: {
          id: updatedSnippet.id,
          title: updatedSnippet.title,
          code: updatedSnippet.code,
          language: updatedSnippet.language,
          explanation: updatedSnippet.explanation
        }
      });
    }

    return NextResponse.json(
      { error: 'No action specified' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Code explanation generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate code explanation' },
      { status: 500 }
    );
  }
}