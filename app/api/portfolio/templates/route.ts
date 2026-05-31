import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { portfolioTemplateSystem } from '@/lib/portfolio/template-system';
import type { PortfolioTemplate, PortfolioTheme } from '@/generated/prisma/browser';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template') as PortfolioTemplate;
    const theme = searchParams.get('theme') as PortfolioTheme;
    const action = searchParams.get('action'); // 'list' or 'config'

    if (action === 'list' || (!template && !theme)) {
      // Return all available templates
      const templates = await portfolioTemplateSystem.getAvailableTemplates();

      return NextResponse.json({
        success: true,
        templates
      });
    }

    if (!template || !theme) {
      return NextResponse.json(
        { error: 'Template and theme parameters are required' },
        { status: 400 }
      );
    }

    // Get specific template configuration
    const config = await portfolioTemplateSystem.getTemplateConfig(template, theme);

    return NextResponse.json({
      success: true,
      template,
      theme,
      config
    });

  } catch (error) {
    console.error('Failed to fetch template data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template data' },
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
      name,
      description,
      category,
      templateType,
      theme,
      sections,
      styling,
      layout,
      isPublic = false,
      isPremium = false
    } = body;

    // Validate required fields
    if (!name || !templateType || !theme || !sections) {
      return NextResponse.json(
        { error: 'Name, template type, theme, and sections are required' },
        { status: 400 }
      );
    }

    // Validate sections structure
    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: 'Sections must be a non-empty array' },
        { status: 400 }
      );
    }

    // Create custom template
    const customTemplate = await portfolioTemplateSystem.createCustomTemplate({
      name,
      description,
      category,
      templateType,
      theme,
      sections,
      styling,
      layout,
      isPublic,
      isPremium
    });

    return NextResponse.json({
      success: true,
      message: 'Custom template created successfully',
      template: {
        id: customTemplate.id,
        name: customTemplate.name,
        description: customTemplate.description,
        category: customTemplate.category,
        templateType: customTemplate.templateType,
        theme: customTemplate.theme,
        isPublic: customTemplate.isPublic,
        isPremium: customTemplate.isPremium
      }
    });

  } catch (error) {
    console.error('Failed to create custom template:', error);
    return NextResponse.json(
      { error: 'Failed to create custom template' },
      { status: 500 }
    );
  }
}