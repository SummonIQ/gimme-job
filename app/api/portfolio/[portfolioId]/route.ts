import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';
import { revalidateTag } from 'next/cache';

export async function GET(
  request: Request,
  { params }: { params: { portfolioId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const portfolioId = params.portfolioId;

    const portfolio = await db.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id
      },
      include: {
        projects: {
          include: {
            _count: {
              select: {
                documentationAssets: true,
                codeSnippets: true,
                testimonials: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        sections: {
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            projects: true,
            views: true,
            shares: true
          }
        }
      }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      portfolio: {
        ...portfolio,
        projectCount: portfolio._count.projects,
        totalViews: portfolio._count.views,
        totalShares: portfolio._count.shares
      }
    });

  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { portfolioId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const portfolioId = params.portfolioId;
    const body = await request.json();

    // Verify user owns the portfolio
    const existingPortfolio = await db.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id
      }
    });

    if (!existingPortfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Handle status change to published
    const updates: any = { ...body };
    if (body.status === 'PUBLISHED' && existingPortfolio.status !== 'PUBLISHED') {
      updates.publishedAt = new Date();
    }

    // Handle default portfolio setting
    if (body.isDefault === true && !existingPortfolio.isDefault) {
      // First, unset any other default portfolios for this user
      await db.portfolio.updateMany({
        where: {
          userId: user.id,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    // Update the portfolio
    const updatedPortfolio = await db.portfolio.update({
      where: { id: portfolioId },
      data: updates
    });

    // Revalidate cache
    revalidateTag(`user:${user.id}:portfolios`);
    revalidateTag(`portfolio:${portfolioId}`);

    return NextResponse.json({
      success: true,
      message: 'Portfolio updated successfully',
      portfolio: {
        id: updatedPortfolio.id,
        title: updatedPortfolio.title,
        description: updatedPortfolio.description,
        status: updatedPortfolio.status,
        isDefault: updatedPortfolio.isDefault,
        publishedAt: updatedPortfolio.publishedAt,
        analyticsEnabled: updatedPortfolio.analyticsEnabled
      }
    });

  } catch (error) {
    console.error('Failed to update portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to update portfolio' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { portfolioId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const portfolioId = params.portfolioId;

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

    // Don't allow deletion of default portfolio if there are other portfolios
    if (portfolio.isDefault) {
      const otherPortfolios = await db.portfolio.count({
        where: {
          userId: user.id,
          id: { not: portfolioId }
        }
      });

      if (otherPortfolios > 0) {
        return NextResponse.json(
          { error: 'Cannot delete the default portfolio. Please set another portfolio as default first.' },
          { status: 400 }
        );
      }
    }

    // Delete the portfolio (cascade will handle related records)
    await db.portfolio.delete({
      where: { id: portfolioId }
    });

    // Revalidate cache
    revalidateTag(`user:${user.id}:portfolios`);

    return NextResponse.json({
      success: true,
      message: 'Portfolio deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to delete portfolio' },
      { status: 500 }
    );
  }
}