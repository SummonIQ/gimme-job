export enum ContactSource {
  LINKEDIN = 'LINKEDIN',
  EVENT = 'EVENT',
  REFERRAL = 'REFERRAL',
  COLD_OUTREACH = 'COLD_OUTREACH',
  COMPANY_WEBSITE = 'COMPANY_WEBSITE',
  OTHER = 'OTHER'
}

export enum ContactStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  RESPONDED = 'RESPONDED',
  MEETING_SCHEDULED = 'MEETING_SCHEDULED',
  CONNECTED = 'CONNECTED',
  REFERRED = 'REFERRED',
  INACTIVE = 'INACTIVE'
}

export enum ContactPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum ReminderType {
  FOLLOW_UP = 'FOLLOW_UP',
  MEETING = 'MEETING',
  APPLICATION = 'APPLICATION',
  THANK_YOU = 'THANK_YOU',
  CUSTOM = 'CUSTOM'
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED'
}

export interface NetworkContact {
  id: string;
  name: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  notes?: string;
  source: ContactSource;
  status: ContactStatus;
  priority: ContactPriority;
  lastContactDate?: Date;
  tags: string[];
  jobLeadId?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface NetworkReminder {
  id: string;
  contactId: string;
  title: string;
  description?: string;
  type: ReminderType;
  status: ReminderStatus;
  dueDate: Date;
  completedDate?: Date;
  notificationSent: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface ContactInteraction {
  id: string;
  contactId: string;
  date: Date;
  type: string;
  notes: string;
  followUpNeeded: boolean;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface NetworkingStats {
  totalContacts: number;
  newContacts: number;
  activeContacts: number;
  referrals: number;
  meetingsScheduled: number;
  pendingReminders: number;
  contactsBySource: Record<ContactSource, number>;
  contactsByStatus: Record<ContactStatus, number>;
  interactionsByMonth: Array<{
    month: string;
    count: number;
  }>;
}
