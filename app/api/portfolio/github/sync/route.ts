import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { githubPortfolioIntegration } from '@/lib/portfolio/github-integration';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sync GitHub repositories
    const result = await githubPortfolioIntegration.syncRepositories(user.id);

    // Revalidate relevant cache tags
    revalidateTag(`user:${user.id}:portfolios`);
    revalidateTag(`user:${user.id}:github`);

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.syncedCount} repositories`,
      syncedCount: result.syncedCount,
      totalRepos: result.totalRepos,
      projects: result.projects.map(project => ({
        id: project.id,
        title: project.title,
        description: project.shortDescription,
        technologies: project.technologies,
        githubUrl: project.githubUrl,
        aiEnhanced: project.aiEnhanced
      }))
    });

  } catch (error) {
    console.error('GitHub sync failed:', error);

    if (error.message.includes('integration not found')) {
      return NextResponse.json(
        { error: 'GitHub integration not configured. Please connect your GitHub account first.' },
        { status: 404 }
      );
    }

    if (error.message.includes('GitHub API error')) {
      return NextResponse.json(
        { error: 'Failed to fetch repositories from GitHub. Please check your access token.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to sync GitHub repositories' },
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
    const { autoSyncRepos, syncPrivateRepos, excludedRepos } = body;

    // Update integration settings
    const updatedIntegration = await githubPortfolioIntegration.updateIntegrationSettings(user.id, {
      autoSyncRepos,
      syncPrivateRepos,
      excludedRepos
    });

    // Revalidate cache
    revalidateTag(`user:${user.id}:github`);

    return NextResponse.json({
      success: true,
      message: 'GitHub integration settings updated',
      settings: {
        autoSyncRepos: updatedIntegration.autoSyncRepos,
        syncPrivateRepos: updatedIntegration.syncPrivateRepos,
        excludedRepos: updatedIntegration.excludedRepos
      }
    });

  } catch (error) {
    console.error('Failed to update GitHub settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}