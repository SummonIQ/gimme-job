import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { visualContentEnhancer } from '@/lib/portfolio/visual-enhancement';
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
      action,
      imageUrl,
      imageType,
      generateAltText = true,
      generateCaption = true
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

    switch (action) {
      case 'audit':
        // Audit project visuals and get suggestions
        result = await visualContentEnhancer.auditProjectVisuals(projectId);
        break;

      case 'enhance':
        // Enhance all visual assets in the project
        result = await visualContentEnhancer.enhanceProjectVisuals(projectId);
        break;

      case 'generate-alt-text':
        if (!imageUrl) {
          return NextResponse.json(
            { error: 'Image URL is required for alt text generation' },
            { status: 400 }
          );
        }

        const altText = await visualContentEnhancer.generateAltText(
          imageUrl,
          `${project.title} - ${imageType || 'project image'}`
        );

        result = { altText };
        break;

      case 'generate-caption':
        if (!imageUrl) {
          return NextResponse.json(
            { error: 'Image URL is required for caption generation' },
            { status: 400 }
          );
        }

        const caption = await visualContentEnhancer.generateImageCaption(imageUrl, {
          title: project.title,
          technologies: project.technologies,
          description: project.description
        });

        result = { caption };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    // Revalidate cache if project was modified
    if (action === 'enhance') {
      revalidateTag(`project:${projectId}`);
      revalidateTag(`portfolio:${project.portfolioId}`);
    }

    return NextResponse.json({
      success: true,
      action,
      result
    });

  } catch (error) {
    console.error('Visual enhancement failed:', error);

    if (error.message.includes('Project not found')) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to enhance visual content' },
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
    const { assetId, altText, description } = body;

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the asset
    const asset = await db.projectDocumentationAsset.findFirst({
      where: {
        id: assetId,
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

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Update asset with new metadata
    const updatedAsset = await db.projectDocumentationAsset.update({
      where: { id: assetId },
      data: {
        ...(altText !== undefined && { altText }),
        ...(description !== undefined && { description })
      }
    });

    // Revalidate cache
    revalidateTag(`project:${asset.project.id}`);

    return NextResponse.json({
      success: true,
      message: 'Asset metadata updated successfully',
      asset: {
        id: updatedAsset.id,
        fileName: updatedAsset.fileName,
        altText: updatedAsset.altText,
        description: updatedAsset.description
      }
    });

  } catch (error) {
    console.error('Asset update failed:', error);
    return NextResponse.json(
      { error: 'Failed to update asset metadata' },
      { status: 500 }
    );
  }
}