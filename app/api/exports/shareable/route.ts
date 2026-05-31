import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { ShareableDashboardManager, generateShareableUrl } from '@/lib/exports/shareable-dashboards';

const manager = new ShareableDashboardManager();

// GET - List user's shareable links
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const links = await manager.getUserShareableLinks();
    
    // Add full URLs to response
    const linksWithUrls = links.map(link => ({
      ...link,
      url: generateShareableUrl(link.token, process.env.NEXT_PUBLIC_BASE_URL),
      // Don't expose password hash
      password: undefined,
    }));
    
    return NextResponse.json({ links: linksWithUrls });
  } catch (error) {
    console.error('Error fetching shareable links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shareable links' },
      { status: 500 }
    );
  }
}

// POST - Create a new shareable link
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      dataTypes,
      dateRange,
      includeDetails = true,
      customFields,
      filters,
      expiresAt,
      allowedDomains,
      requiresPassword = false,
      password
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!dataTypes || !Array.isArray(dataTypes) || dataTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one data type is required' },
        { status: 400 }
      );
    }

    if (requiresPassword && !password?.trim()) {
      return NextResponse.json(
        { error: 'Password is required when password protection is enabled' },
        { status: 400 }
      );
    }

    // Parse date range
    let parsedDateRange;
    if (dateRange) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }
      
      parsedDateRange = { start, end };
    }

    // Parse expiration date
    let parsedExpiresAt;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime()) || parsedExpiresAt <= new Date()) {
        return NextResponse.json(
          { error: 'Expiration date must be in the future' },
          { status: 400 }
        );
      }
    }

    const token = await manager.createShareableLink({
      name,
      description,
      dataTypes,
      dateRange: parsedDateRange,
      includeDetails,
      customFields,
      filters,
      expiresAt: parsedExpiresAt,
      allowedDomains,
      requiresPassword,
      password
    });

    const url = generateShareableUrl(token, process.env.NEXT_PUBLIC_BASE_URL);
    
    return NextResponse.json({ 
      success: true, 
      token,
      url,
      message: 'Shareable link created successfully'
    });
  } catch (error) {
    console.error('Error creating shareable link:', error);
    return NextResponse.json(
      { error: 'Failed to create shareable link' },
      { status: 500 }
    );
  }
}

// PUT - Update a shareable link
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token, ...updates } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Parse expiration date if provided
    if (updates.expiresAt) {
      const expiresAt = new Date(updates.expiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return NextResponse.json(
          { error: 'Expiration date must be in the future' },
          { status: 400 }
        );
      }
      updates.expiresAt = expiresAt;
    }

    await manager.updateShareableLink(token, updates);
    
    return NextResponse.json({ 
      success: true,
      message: 'Shareable link updated successfully'
    });
  } catch (error) {
    console.error('Error updating shareable link:', error);
    return NextResponse.json(
      { error: 'Failed to update shareable link' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a shareable link
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    await manager.deleteShareableLink(token);
    
    return NextResponse.json({ 
      success: true,
      message: 'Shareable link deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shareable link:', error);
    return NextResponse.json(
      { error: 'Failed to delete shareable link' },
      { status: 500 }
    );
  }
}