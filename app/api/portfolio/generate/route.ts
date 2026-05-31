import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { portfolioGenerator } from '@/lib/portfolio/portfolio-generator';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      template = 'MODERN_TECH',
      theme = 'MINIMAL_LIGHT',
      includeResume = true,
      includeGithubProjects = true,
      targetRole,
      industry,
      personalStatement,
      selectedSkills = []
    } = body;

    // Validate inputs
    if (selectedSkills && !Array.isArray(selectedSkills)) {
      return NextResponse.json(
        { error: 'selectedSkills must be an array' },
        { status: 400 }
      );
    }

    // Generate the portfolio
    const result = await portfolioGenerator.generatePortfolio({
      userId: user.id,
      template,
      theme,
      includeResume,
      includeGithubProjects,
      targetRole,
      industry,
      personalStatement,
      selectedSkills
    });

    // Revalidate cache
    revalidateTag(`user:${user.id}:portfolios`);
    revalidateTag(`portfolio:${result.portfolio.id}`);

    return NextResponse.json({
      success: true,
      portfolio: {
        id: result.portfolio.id,
        title: result.portfolio.title,
        slug: result.portfolio.slug,
        status: result.portfolio.status,
        template: result.portfolio.template,
        theme: result.portfolio.theme,
        projectCount: result.generatedProjects.length
      },
      projectsGenerated: result.generatedProjects.length,
      aiEnhanced: {
        personalStatement: !!result.aiEnhancedContent.personalStatement,
        skillsHighlight: result.aiEnhancedContent.skillsHighlight.length,
        seoOptimized: !!result.aiEnhancedContent.seoTitle
      }
    });

  } catch (error) {
    console.error('Portfolio generation failed:', error);

    // Handle specific error types
    if (error.message.includes('User not found')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (error.message.includes('AI generation failed')) {
      return NextResponse.json(
        { error: 'AI content generation failed. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate portfolio' },
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
      portfolioId,
      targetRole,
      industry,
      personalStatement,
      selectedSkills = []
    } = body;

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Portfolio ID is required' },
        { status: 400 }
      );
    }

    // Enhance existing portfolio
    const updatedPortfolio = await portfolioGenerator.enhanceExistingPortfolio(portfolioId, {
      targetRole,
      industry,
      personalStatement,
      selectedSkills
    });

    // Revalidate cache
    revalidateTag(`user:${user.id}:portfolios`);
    revalidateTag(`portfolio:${portfolioId}`);

    return NextResponse.json({
      success: true,
      portfolio: {
        id: updatedPortfolio.id,
        title: updatedPortfolio.title,
        personalStatement: updatedPortfolio.personalStatement,
        skillsHighlight: updatedPortfolio.skillsHighlight,
        seoTitle: updatedPortfolio.seoTitle,
        seoDescription: updatedPortfolio.seoDescription
      }
    });

  } catch (error) {
    console.error('Portfolio enhancement failed:', error);

    if (error.message.includes('Portfolio not found')) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to enhance portfolio' },
      { status: 500 }
    );
  }
}