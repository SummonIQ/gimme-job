/**
 * Types for sharing functionality
 */

export enum ShareableResourceType {
  JOB_LEAD = 'JOB_LEAD',
  RESUME = 'RESUME'
}

export enum ShareAccessLevel {
  VIEW = 'VIEW',
  COMMENT = 'COMMENT',
  EDIT = 'EDIT'
}

export enum ShareStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED'
}

export interface ShareLink {
  id: string;
  resourceId: string;
  resourceType: ShareableResourceType;
  accessLevel: ShareAccessLevel;
  status: ShareStatus;
  token: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  recipientEmail?: string;
  lastAccessedAt?: Date;
  accessCount: number;
  allowFeedback: boolean;
}

export interface ShareFeedback {
  id: string;
  shareLinkId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  createdByEmail?: string;
  createdByName?: string;
}

export interface ShareOptions {
  accessLevel: ShareAccessLevel;
  expirationDays?: number;
  recipientEmail?: string;
  allowFeedback?: boolean;
}
