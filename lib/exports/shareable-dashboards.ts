import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { getUserAnalytics, type AnalyticsData } from '@/lib/analytics';
import { randomBytes } from 'crypto';

export interface ShareableLink {
  id: string;
  token: string;
  name: string;
  description?: string;
  dashboardConfig: {
    dataTypes: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    includeDetails: boolean;
    customFields?: string[];
    filters?: Record<string, any>;
  };
  expiresAt?: Date;
  isActive: boolean;
  allowedDomains?: string[];
  requiresPassword?: boolean;
  password?: string;
  accessCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShareableDashboardData {
  link: ShareableLink;
  analytics: AnalyticsData;
  metadata: {
    generatedAt: Date;
    recordCount: number;
    dateRange: { start: Date; end: Date };
  };
}

export class ShareableDashboardManager {
  /**
   * Create a shareable dashboard link
   */
  async createShareableLink(config: {
    name: string;
    description?: string;
    dataTypes: string[];
    dateRange?: { start: Date; end: Date };
    includeDetails: boolean;
    customFields?: string[];
    filters?: Record<string, any>;
    expiresAt?: Date;
    allowedDomains?: string[];
    requiresPassword?: boolean;
    password?: string;
  }): Promise<string> {
    const user = await getCurrentUser();
    
    // Generate a secure token
    const token = randomBytes(32).toString('hex');
    
    // Hash password if provided
    let hashedPassword;
    if (config.requiresPassword && config.password) {
      const bcrypt = await import('bcryptjs');
      hashedPassword = await bcrypt.hash(config.password, 12);
    }

    const link = await db.shareableLink.create({
      data: {
        userId: user.id,
        token,
        name: config.name,
        description: config.description,
        dashboardConfig: {
          dataTypes: config.dataTypes,
          dateRange: config.dateRange,
          includeDetails: config.includeDetails,
          customFields: config.customFields || [],
          filters: config.filters || {},
        },
        expiresAt: config.expiresAt,
        isActive: true,
        allowedDomains: config.allowedDomains || [],
        requiresPassword: config.requiresPassword || false,
        password: hashedPassword,
        accessCount: 0,
      }
    });

    return link.token;
  }

  /**
   * Update a shareable link
   */
  async updateShareableLink(token: string, updates: Partial<{
    name: string;
    description: string;
    isActive: boolean;
    expiresAt: Date;
    allowedDomains: string[];
    requiresPassword: boolean;
    password: string;
  }>): Promise<void> {
    const user = await getCurrentUser();
    
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // Hash new password if provided
    if (updates.password) {
      const bcrypt = await import('bcryptjs');
      updateData.password = await bcrypt.hash(updates.password, 12);
    }

    await db.shareableLink.update({
      where: {
        token,
        userId: user.id,
      },
      data: updateData,
    });
  }

  /**
   * Delete a shareable link
   */
  async deleteShareableLink(token: string): Promise<void> {
    const user = await getCurrentUser();
    
    await db.shareableLink.delete({
      where: {
        token,
        userId: user.id,
      },
    });
  }

  /**
   * Get user's shareable links
   */
  async getUserShareableLinks(): Promise<ShareableLink[]> {
    const user = await getCurrentUser();
    
    const links = await db.shareableLink.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return links.map(link => ({
      id: link.id,
      token: link.token,
      name: link.name,
      description: link.description || undefined,
      dashboardConfig: link.dashboardConfig as any,
      expiresAt: link.expiresAt || undefined,
      isActive: link.isActive,
      allowedDomains: link.allowedDomains as string[],
      requiresPassword: link.requiresPassword,
      password: link.password || undefined,
      accessCount: link.accessCount,
      lastAccessedAt: link.lastAccessedAt || undefined,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }));
  }

  /**
   * Get shareable dashboard data by token
   */
  async getShareableDashboard(token: string, options?: {
    password?: string;
    domain?: string;
  }): Promise<ShareableDashboardData> {
    const link = await db.shareableLink.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!link) {
      throw new Error('Shareable link not found');
    }

    // Check if link is active
    if (!link.isActive) {
      throw new Error('This shareable link has been disabled');
    }

    // Check expiration
    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new Error('This shareable link has expired');
    }

    // Check domain restrictions
    if (options?.domain && link.allowedDomains.length > 0) {
      const isAllowed = link.allowedDomains.some(allowedDomain => 
        options.domain?.includes(allowedDomain)
      );
      if (!isAllowed) {
        throw new Error('Access denied: domain not allowed');
      }
    }

    // Check password
    if (link.requiresPassword && link.password) {
      if (!options?.password) {
        throw new Error('Password required');
      }
      
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.compare(options.password, link.password);
      if (!isValidPassword) {
        throw new Error('Invalid password');
      }
    }

    // Get analytics data
    const config = link.dashboardConfig as any;
    const dateRange = config.dateRange || {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      end: new Date()
    };

    const analytics = await getUserAnalytics({
      days: Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)),
      startDate: dateRange.start,
      endDate: dateRange.end
    });

    // Update access tracking
    await db.shareableLink.update({
      where: { token },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    return {
      link: {
        id: link.id,
        token: link.token,
        name: link.name,
        description: link.description || undefined,
        dashboardConfig: config,
        expiresAt: link.expiresAt || undefined,
        isActive: link.isActive,
        allowedDomains: link.allowedDomains as string[],
        requiresPassword: link.requiresPassword,
        accessCount: link.accessCount + 1,
        lastAccessedAt: new Date(),
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      },
      analytics,
      metadata: {
        generatedAt: new Date(),
        recordCount: analytics.overview.total,
        dateRange,
      },
    };
  }

  /**
   * Validate shareable link access
   */
  async validateAccess(token: string, options?: {
    password?: string;
    domain?: string;
  }): Promise<{ valid: boolean; requiresPassword: boolean; error?: string }> {
    try {
      const link = await db.shareableLink.findUnique({
        where: { token },
      });

      if (!link) {
        return { valid: false, requiresPassword: false, error: 'Link not found' };
      }

      if (!link.isActive) {
        return { valid: false, requiresPassword: false, error: 'Link has been disabled' };
      }

      if (link.expiresAt && new Date() > link.expiresAt) {
        return { valid: false, requiresPassword: false, error: 'Link has expired' };
      }

      if (options?.domain && link.allowedDomains.length > 0) {
        const isAllowed = link.allowedDomains.some(allowedDomain => 
          options.domain?.includes(allowedDomain)
        );
        if (!isAllowed) {
          return { valid: false, requiresPassword: false, error: 'Domain not allowed' };
        }
      }

      if (link.requiresPassword) {
        if (!options?.password) {
          return { valid: false, requiresPassword: true };
        }
        
        if (link.password) {
          const bcrypt = await import('bcryptjs');
          const isValidPassword = await bcrypt.compare(options.password, link.password);
          if (!isValidPassword) {
            return { valid: false, requiresPassword: true, error: 'Invalid password' };
          }
        }
      }

      return { valid: true, requiresPassword: false };
    } catch (error) {
      return { valid: false, requiresPassword: false, error: 'Validation failed' };
    }
  }

  /**
   * Get access analytics for a shareable link
   */
  async getLinkAnalytics(token: string): Promise<{
    totalAccesses: number;
    lastAccessed?: Date;
    dailyAccesses: { date: string; count: number }[];
  }> {
    const user = await getCurrentUser();
    
    const link = await db.shareableLink.findUnique({
      where: {
        token,
        userId: user.id,
      },
    });

    if (!link) {
      throw new Error('Shareable link not found');
    }

    // For now, return basic analytics
    // This could be expanded to track detailed access logs
    return {
      totalAccesses: link.accessCount,
      lastAccessed: link.lastAccessedAt || undefined,
      dailyAccesses: [], // Could be implemented with access log table
    };
  }
}

// Utility functions
export function generateShareableUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/shared/${token}`;
}

export function isLinkExpired(expiresAt?: Date): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

export function formatExpirationDate(expiresAt?: Date): string {
  if (!expiresAt) return 'Never expires';
  
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffDays < 7) return `Expires in ${diffDays} days`;
  if (diffDays < 30) return `Expires in ${Math.ceil(diffDays / 7)} weeks`;
  
  return `Expires on ${expiresAt.toLocaleDateString()}`;
}