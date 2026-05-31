import { db } from "@/lib/db/client";

interface AuditLogData {
  userId: string;
  action: string;
  details: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function createAuditLog(data: AuditLogData) {
  try {
    return await db.automationAuditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        details: JSON.stringify(data.details),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw error to prevent blocking main operations
    return null;
  }
}