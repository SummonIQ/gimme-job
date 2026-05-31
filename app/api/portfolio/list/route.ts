import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';
import { cache } from 'react';

const getUserPortfolios = cache(async (userId: string) => {
  return db.portfolio.findMany({
    where: { userId },
    include: {
      projects: {
        select: { id: true, aiEnhanced: true }
      },
      _count: {
        select: {
          projects: true,
          views: true
        }
      }
    },
    orderBy: [
      { isDefault: 'desc' },
      { updatedAt: 'desc' }
    ]
  });
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const portfolios = await getUserPortfolios(user.id);

    const portfoliosWithStats = portfolios.map(portfolio => ({
      id: portfolio.id,
      title: portfolio.title,
      description: portfolio.description,
      slug: portfolio.slug,
      template: portfolio.template,
      theme: portfolio.theme,
      status: portfolio.status,
      isDefault: portfolio.isDefault,
      viewCount: portfolio.viewCount,
      lastViewedAt: portfolio.lastViewedAt,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      projectCount: portfolio._count.projects,
      totalViews: portfolio._count.views,
      analyticsEnabled: portfolio.analyticsEnabled,
      aiEnhancedProjects: portfolio.projects.filter(p => p.aiEnhanced).length
    }));

    return NextResponse.json({
      success: true,
      portfolios: portfoliosWithStats,
      totalPortfolios: portfolios.length
    });

  } catch (error) {
    console.error('Failed to fetch portfolios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolios' },
      { status: 500 }
    );
  }
}