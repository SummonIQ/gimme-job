"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { refreshTokenIfNeeded } from "@/lib/api/linkedin-client";
import { createAuditLog } from "@/lib/automation/audit";
import { LinkedInConnectionStatus, LinkedInTemplateType } from "@/generated/prisma/client";

/**
 * LinkedIn Connection Automation Service
 * Handles automated connection requests, message templating, and follow-up sequences
 */

// Rate limits for LinkedIn connections (conservative approach)
const DAILY_CONNECTION_LIMIT = 10;
const WEEKLY_CONNECTION_LIMIT = 50;
const MONTHLY_CONNECTION_LIMIT = 200;
const CONNECTION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes between connections

export interface ConnectionTarget {
  profileId: string;
  name: string;
  headline?: string;
  company?: string;
  imageUrl?: string;
  profileUrl?: string;
  mutualConnections?: number;
  jobLeadId?: string;
}

export interface ConnectionRequest {
  target: ConnectionTarget;
  templateId?: string;
  message?: string;
  campaignId?: string;
  tags?: string[];
  notes?: string;
  scheduleAt?: Date;
}

export interface ConnectionStats {
  totalSent: number;
  totalAccepted: number;
  totalPending: number;
  totalRejected: number;
  acceptanceRate: number;
  dailySent: number;
  weeklySent: number;
  monthlySent: number;
  canSendToday: boolean;
  nextAvailableSlot: Date | null;
}

/**
 * Send a connection request to a LinkedIn profile
 */
export async function sendConnectionRequest(request: ConnectionRequest): Promise<{
  success: boolean;
  connectionId?: string;
  error?: string;
  scheduled?: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  try {
    // Check rate limits
    const stats = await getConnectionStats();
    if (!stats.canSendToday) {
      // Schedule for next available slot if requested
      if (request.scheduleAt || stats.nextAvailableSlot) {
        const scheduledFor = request.scheduleAt || stats.nextAvailableSlot!;
        const connection = await scheduleConnectionRequest(request, scheduledFor);
        return {
          success: true,
          connectionId: connection.id,
          scheduled: true,
        };
      }
      return { success: false, error: "Daily connection limit reached" };
    }

    // Check for duplicate connection
    const existingConnection = await db.linkedInConnection.findFirst({
      where: {
        userId: user.id,
        targetProfileId: request.target.profileId,
      },
    });

    if (existingConnection) {
      return { success: false, error: "Connection already exists or was already sent" };
    }

    // Get or create message from template
    let message = request.message;
    if (!message && request.templateId) {
      const template = await db.linkedInMessageTemplate.findFirst({
        where: {
          id: request.templateId,
          userId: user.id,
          isActive: true,
        },
      });

      if (template) {
        message = await personalizeMessage(template.message, request.target);
      }
    }

    // Check LinkedIn credentials
    const credentials = await refreshTokenIfNeeded();
    if (!credentials) {
      return { success: false, error: "LinkedIn authentication required" };
    }

    // Create connection record
    const connection = await db.linkedInConnection.create({
      data: {
        userId: user.id,
        targetProfileId: request.target.profileId,
        targetName: request.target.name,
        targetHeadline: request.target.headline,
        targetCompany: request.target.company,
        targetImageUrl: request.target.imageUrl,
        targetUrl: request.target.profileUrl,
        connectionMessage: message,
        templateId: request.templateId,
        campaignId: request.campaignId,
        tags: request.tags || [],
        notes: request.notes,
        jobLeadId: request.target.jobLeadId,
        status: LinkedInConnectionStatus.PENDING,
      },
    });

    // Send connection request via LinkedIn API or web automation
    const result = await sendLinkedInConnectionRequest(
      credentials.accessToken,
      request.target.profileId,
      message
    );

    if (result.success) {
      // Update connection with sent timestamp
      await db.linkedInConnection.update({
        where: { id: connection.id },
        data: {
          connectionSentAt: new Date(),
          status: LinkedInConnectionStatus.PENDING,
        },
      });

      // Update template usage
      if (request.templateId) {
        await db.linkedInMessageTemplate.update({
          where: { id: request.templateId },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      }

      // Create audit log
      await createAuditLog({
        userId: user.id,
        action: "CONNECTION_REQUEST_SENT",
        details: {
          connectionId: connection.id,
          targetProfileId: request.target.profileId,
          targetName: request.target.name,
          campaignId: request.campaignId,
        },
      });

      // Schedule follow-up if enabled
      const settings = await getAutomationSettings(user.id);
      if (settings.autoFollowUp) {
        await scheduleFollowUp(connection.id, settings.followUpDelay);
      }

      return {
        success: true,
        connectionId: connection.id,
      };
    } else {
      // Update connection with error status
      await db.linkedInConnection.update({
        where: { id: connection.id },
        data: {
          status: LinkedInConnectionStatus.ERROR,
        },
      });

      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("Connection request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Schedule a connection request for later
 */
async function scheduleConnectionRequest(
  request: ConnectionRequest,
  scheduledFor: Date
): Promise<any> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  return await db.linkedInConnection.create({
    data: {
      userId: user.id,
      targetProfileId: request.target.profileId,
      targetName: request.target.name,
      targetHeadline: request.target.headline,
      targetCompany: request.target.company,
      targetImageUrl: request.target.imageUrl,
      targetUrl: request.target.profileUrl,
      connectionMessage: request.message,
      templateId: request.templateId,
      campaignId: request.campaignId,
      tags: request.tags || [],
      notes: request.notes,
      jobLeadId: request.target.jobLeadId,
      status: LinkedInConnectionStatus.PENDING,
      // Note: We'd need to add a scheduledFor field to the model for proper scheduling
    },
  });
}

/**
 * Send connection request via LinkedIn API
 */
async function sendLinkedInConnectionRequest(
  accessToken: string,
  profileId: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // This would use LinkedIn's API to send connection request
    // Note: LinkedIn's current API doesn't support sending connection requests
    // This would need to be implemented via web automation (Puppeteer)
    
    // For now, we'll simulate the API call
    const response = await fetch("https://api.linkedin.com/v2/invitations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202401",
      },
      body: JSON.stringify({
        inviteMessage: message,
        inviteeProfileId: profileId,
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error: `LinkedIn API error: ${error}` };
    }
  } catch (error) {
    console.error("LinkedIn connection request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get connection statistics for the current user
 */
export async function getConnectionStats(): Promise<ConnectionStats> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalStats,
    dailyCount,
    weeklyCount,
    monthlyCount,
    lastConnection,
  ] = await Promise.all([
    db.linkedInConnection.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: true,
    }),
    db.linkedInConnection.count({
      where: {
        userId: user.id,
        connectionSentAt: { gte: today },
      },
    }),
    db.linkedInConnection.count({
      where: {
        userId: user.id,
        connectionSentAt: { gte: weekAgo },
      },
    }),
    db.linkedInConnection.count({
      where: {
        userId: user.id,
        connectionSentAt: { gte: monthAgo },
      },
    }),
    db.linkedInConnection.findFirst({
      where: {
        userId: user.id,
        connectionSentAt: { not: null },
      },
      orderBy: { connectionSentAt: "desc" },
    }),
  ]);

  // Calculate totals by status
  const totalSent = totalStats.reduce((sum, stat) => sum + stat._count, 0);
  const totalAccepted = totalStats.find(s => s.status === "ACCEPTED")?._count || 0;
  const totalPending = totalStats.find(s => s.status === "PENDING")?._count || 0;
  const totalRejected = totalStats.find(s => s.status === "REJECTED")?._count || 0;

  const acceptanceRate = totalSent > 0 ? (totalAccepted / totalSent) * 100 : 0;

  // Get automation settings for limits
  const settings = await getAutomationSettings(user.id);
  const canSendToday = dailyCount < settings.dailyConnectionLimit;

  // Calculate next available slot
  let nextAvailableSlot: Date | null = null;
  if (!canSendToday) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM next day
    nextAvailableSlot = tomorrow;
  } else if (lastConnection?.connectionSentAt) {
    const nextSlot = new Date(lastConnection.connectionSentAt.getTime() + CONNECTION_INTERVAL_MS);
    if (nextSlot > now) {
      nextAvailableSlot = nextSlot;
    }
  }

  return {
    totalSent,
    totalAccepted,
    totalPending,
    totalRejected,
    acceptanceRate: Math.round(acceptanceRate * 100) / 100,
    dailySent: dailyCount,
    weeklySent: weeklyCount,
    monthlySent: monthlyCount,
    canSendToday,
    nextAvailableSlot,
  };
}

/**
 * Personalize a message template with target information
 */
export async function personalizeMessage(
  template: string,
  target: ConnectionTarget
): Promise<string> {
  let personalizedMessage = template;

  // Replace template variables
  const replacements: Record<string, string> = {
    "{firstName}": target.name.split(" ")[0] || target.name,
    "{fullName}": target.name,
    "{company}": target.company || "your company",
    "{headline}": target.headline || "your role",
  };

  for (const [variable, value] of Object.entries(replacements)) {
    personalizedMessage = personalizedMessage.replace(new RegExp(variable, "g"), value);
  }

  return personalizedMessage;
}

/**
 * Get automation settings for a user
 */
export async function getAutomationSettings(userId: string) {
  let settings = await db.linkedInAutomationSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    // Create default settings
    settings = await db.linkedInAutomationSettings.create({
      data: { userId },
    });
  }

  return settings;
}

/**
 * Schedule a follow-up message
 */
async function scheduleFollowUp(connectionId: string, delaySeconds: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const scheduledAt = new Date(Date.now() + delaySeconds * 1000);

  await db.linkedInFollowUp.create({
    data: {
      userId: user.id,
      connectionId,
      message: "Thank you for connecting! I'd love to learn more about your experience at {company}.",
      scheduledAt,
    },
  });
}

/**
 * Update connection status (typically called from webhooks or manual updates)
 */
export async function updateConnectionStatus(
  connectionId: string,
  status: LinkedInConnectionStatus,
  metadata?: Record<string, any>
): Promise<void> {
  const updateData: any = { status };

  if (status === LinkedInConnectionStatus.ACCEPTED) {
    updateData.connectionAcceptedAt = new Date();
    updateData.responseReceived = true;
    updateData.responseAt = new Date();
    updateData.responseType = "accepted";
  } else if (status === LinkedInConnectionStatus.REJECTED) {
    updateData.connectionRejectedAt = new Date();
    updateData.responseReceived = true;
    updateData.responseAt = new Date();
    updateData.responseType = "rejected";
  }

  await db.linkedInConnection.update({
    where: { id: connectionId },
    data: updateData,
  });

  // Update template success rate if connection was from a template
  const connection = await db.linkedInConnection.findUnique({
    where: { id: connectionId },
    select: { templateId: true, userId: true },
  });

  if (connection?.templateId && status === LinkedInConnectionStatus.ACCEPTED) {
    await updateTemplateSuccessRate(connection.templateId);
  }
}

/**
 * Update template success rate
 */
async function updateTemplateSuccessRate(templateId: string): Promise<void> {
  const stats = await db.linkedInConnection.groupBy({
    by: ["status"],
    where: { templateId },
    _count: true,
  });

  const total = stats.reduce((sum, stat) => sum + stat._count, 0);
  const accepted = stats.find(s => s.status === "ACCEPTED")?._count || 0;
  const successRate = total > 0 ? (accepted / total) * 100 : 0;

  await db.linkedInMessageTemplate.update({
    where: { id: templateId },
    data: { successRate },
  });
}

/**
 * Get connections for a user with filtering and pagination
 */
export async function getConnections(options: {
  status?: LinkedInConnectionStatus;
  campaignId?: string;
  limit?: number;
  offset?: number;
  search?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const where: any = { userId: user.id };
  
  if (options.status) {
    where.status = options.status;
  }
  
  if (options.campaignId) {
    where.campaignId = options.campaignId;
  }
  
  if (options.search) {
    where.OR = [
      { targetName: { contains: options.search, mode: "insensitive" } },
      { targetCompany: { contains: options.search, mode: "insensitive" } },
      { targetHeadline: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const [connections, total] = await Promise.all([
    db.linkedInConnection.findMany({
      where,
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
        followUps: {
          orderBy: { scheduledAt: "desc" },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: options.offset || 0,
      take: options.limit || 50,
    }),
    db.linkedInConnection.count({ where }),
  ]);

  return { connections, total };
}

/**
 * Bulk actions for connections
 */
export async function bulkUpdateConnections(
  connectionIds: string[],
  action: "accept" | "reject" | "withdraw" | "add_tag" | "remove_tag",
  data?: any
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, updated: 0, errors: ["User not authenticated"] };
  }

  const errors: string[] = [];
  let updated = 0;

  for (const connectionId of connectionIds) {
    try {
      switch (action) {
        case "accept":
          await updateConnectionStatus(connectionId, LinkedInConnectionStatus.ACCEPTED);
          break;
        case "reject":
          await updateConnectionStatus(connectionId, LinkedInConnectionStatus.REJECTED);
          break;
        case "withdraw":
          await updateConnectionStatus(connectionId, LinkedInConnectionStatus.WITHDRAWN);
          break;
        case "add_tag":
          if (data?.tag) {
            await db.linkedInConnection.update({
              where: { id: connectionId, userId: user.id },
              data: {
                tags: { push: data.tag },
              },
            });
          }
          break;
        case "remove_tag":
          if (data?.tag) {
            const connection = await db.linkedInConnection.findUnique({
              where: { id: connectionId, userId: user.id },
              select: { tags: true },
            });
            if (connection) {
              const newTags = connection.tags.filter(tag => tag !== data.tag);
              await db.linkedInConnection.update({
                where: { id: connectionId },
                data: { tags: newTags },
              });
            }
          }
          break;
      }
      updated++;
    } catch (error) {
      errors.push(`Failed to update connection ${connectionId}: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    updated,
    errors,
  };
}

/**
 * Check if user has hit rate limits for connection requests
 */
export async function checkRateLimit(userId: string): Promise<{
  canSend: boolean;
  reason?: string;
  resetAt?: Date;
}> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [dailyCount, weeklyCount, monthlyCount] = await Promise.all([
    db.linkedInConnection.count({
      where: {
        userId,
        sentAt: { gte: today },
        status: { not: 'WITHDRAWN' },
      },
    }),
    db.linkedInConnection.count({
      where: {
        userId,
        sentAt: { gte: weekAgo },
        status: { not: 'WITHDRAWN' },
      },
    }),
    db.linkedInConnection.count({
      where: {
        userId,
        sentAt: { gte: monthAgo },
        status: { not: 'WITHDRAWN' },
      },
    }),
  ]);

  if (dailyCount >= DAILY_CONNECTION_LIMIT) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      canSend: false,
      reason: `Daily limit of ${DAILY_CONNECTION_LIMIT} connections reached`,
      resetAt: tomorrow,
    };
  }

  if (weeklyCount >= WEEKLY_CONNECTION_LIMIT) {
    const nextWeek = new Date(weekAgo);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return {
      canSend: false,
      reason: `Weekly limit of ${WEEKLY_CONNECTION_LIMIT} connections reached`,
      resetAt: nextWeek,
    };
  }

  if (monthlyCount >= MONTHLY_CONNECTION_LIMIT) {
    const nextMonth = new Date(monthAgo);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return {
      canSend: false,
      reason: `Monthly limit of ${MONTHLY_CONNECTION_LIMIT} connections reached`,
      resetAt: nextMonth,
    };
  }

  return { canSend: true };
}