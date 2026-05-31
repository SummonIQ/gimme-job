import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { AppError, ErrorCode } from '@/lib/errors';
import { ContactPriority, ContactSource, ContactStatus, NetworkContact } from './types';
import { nanoid } from 'nanoid';

/**
 * Create a new networking contact
 */
export async function createNetworkContact(
  data: Omit<NetworkContact, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<NetworkContact> {
  const user = await getCurrentUser();
  
  if (!data.name) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Contact name is required',
    });
  }
  
  const contact = await db.networkContact.create({
    data: {
      ...data,
      tags: data.tags || [],
      status: data.status || ContactStatus.NEW,
      source: data.source || ContactSource.OTHER,
      priority: data.priority || ContactPriority.MEDIUM,
      userId: user.id,
    },
  });
  
  return contact;
}

/**
 * Update an existing networking contact
 */
export async function updateNetworkContact(
  id: string,
  data: Partial<Omit<NetworkContact, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
): Promise<NetworkContact> {
  const user = await getCurrentUser();
  
  const contact = await db.networkContact.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });
  
  if (!contact) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Contact with ID ${id} not found`,
    });
  }
  
  const updatedContact = await db.networkContact.update({
    where: {
      id,
      userId: user.id,
    },
    data,
  });
  
  return updatedContact;
}

/**
 * Delete a networking contact
 */
export async function deleteNetworkContact(id: string): Promise<void> {
  const user = await getCurrentUser();
  
  const contact = await db.networkContact.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });
  
  if (!contact) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Contact with ID ${id} not found`,
    });
  }
  
  await db.networkContact.delete({
    where: {
      id,
      userId: user.id,
    },
  });
}

/**
 * Get a single networking contact
 */
export async function getNetworkContact(id: string): Promise<NetworkContact> {
  const user = await getCurrentUser();
  
  const contact = await db.networkContact.findUnique({
    where: {
      id,
      userId: user.id,
    },
    include: {
      reminders: true,
      interactions: true,
      jobLead: {
        include: {
          jobListing: true,
        },
      },
    },
  });
  
  if (!contact) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Contact with ID ${id} not found`,
    });
  }
  
  return contact;
}

/**
 * Get all networking contacts
 */
export async function getNetworkContacts(options: {
  status?: ContactStatus;
  source?: ContactSource;
  priority?: ContactPriority;
  search?: string;
  tag?: string;
  sort?: 'name' | 'lastContactDate' | 'createdAt' | 'priority';
  sortDirection?: 'asc' | 'desc';
} = {}): Promise<NetworkContact[]> {
  const user = await getCurrentUser();
  
  const {
    status,
    source,
    priority,
    search,
    tag,
    sort = 'createdAt',
    sortDirection = 'desc',
  } = options;
  
  // Build filters
  const filters: any = {
    userId: user.id,
  };
  
  if (status) {
    filters.status = status;
  }
  
  if (source) {
    filters.source = source;
  }
  
  if (priority) {
    filters.priority = priority;
  }
  
  if (search) {
    filters.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { position: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (tag) {
    filters.tags = {
      has: tag,
    };
  }
  
  const contacts = await db.networkContact.findMany({
    where: filters,
    include: {
      reminders: {
        where: {
          status: 'PENDING',
        },
        orderBy: {
          dueDate: 'asc',
        },
        take: 1,
      },
      _count: {
        select: {
          interactions: true,
          reminders: true,
        },
      },
    },
    orderBy: {
      [sort]: sortDirection,
    },
  });
  
  return contacts;
}

/**
 * Add a new interaction to a contact
 */
export async function addContactInteraction(
  contactId: string,
  data: {
    date: Date;
    type: string;
    notes: string;
    followUpNeeded: boolean;
    followUpDate?: Date;
  }
): Promise<any> {
  const user = await getCurrentUser();
  
  // Verify contact exists and belongs to user
  const contact = await db.networkContact.findUnique({
    where: {
      id: contactId,
      userId: user.id,
    },
  });
  
  if (!contact) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Contact with ID ${contactId} not found`,
    });
  }
  
  // Create the interaction
  const interaction = await db.contactInteraction.create({
    data: {
      ...data,
      contactId,
      userId: user.id,
    },
  });
  
  // Update the contact's last contact date
  await db.networkContact.update({
    where: {
      id: contactId,
    },
    data: {
      lastContactDate: data.date,
      // If status is NEW, update to CONTACTED
      ...(contact.status === ContactStatus.NEW
        ? { status: ContactStatus.CONTACTED }
        : {}),
    },
  });
  
  // If follow-up is needed, create a reminder
  if (data.followUpNeeded && data.followUpDate) {
    await db.networkReminder.create({
      data: {
        contactId,
        title: `Follow up with ${contact.name}`,
        description: `Follow up regarding: ${data.notes.substring(0, 100)}${
          data.notes.length > 100 ? '...' : ''
        }`,
        type: 'FOLLOW_UP',
        status: 'PENDING',
        dueDate: data.followUpDate,
        notificationSent: false,
        userId: user.id,
      },
    });
  }
  
  return interaction;
}

/**
 * Get all interactions for a contact
 */
export async function getContactInteractions(contactId: string): Promise<any[]> {
  const user = await getCurrentUser();
  
  // Verify contact exists and belongs to user
  const contact = await db.networkContact.findUnique({
    where: {
      id: contactId,
      userId: user.id,
    },
  });
  
  if (!contact) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Contact with ID ${contactId} not found`,
    });
  }
  
  const interactions = await db.contactInteraction.findMany({
    where: {
      contactId,
      userId: user.id,
    },
    orderBy: {
      date: 'desc',
    },
  });
  
  return interactions;
}

/**
 * Import contacts from LinkedIn or other sources
 */
export async function importContacts(
  contacts: Array<Omit<NetworkContact, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>,
  source: ContactSource
): Promise<{ imported: number; failed: number; existing: number }> {
  const user = await getCurrentUser();
  
  let imported = 0;
  let failed = 0;
  let existing = 0;
  
  for (const contact of contacts) {
    try {
      // Check if contact already exists (by email or LinkedIn URL)
      const existingContact = await db.networkContact.findFirst({
        where: {
          userId: user.id,
          OR: [
            contact.email ? { email: contact.email } : {},
            contact.linkedinUrl ? { linkedinUrl: contact.linkedinUrl } : {},
          ],
        },
      });
      
      if (existingContact) {
        existing++;
        continue;
      }
      
      // Create new contact
      await db.networkContact.create({
        data: {
          ...contact,
          id: nanoid(),
          source: source || contact.source || ContactSource.OTHER,
          tags: contact.tags || [],
          status: contact.status || ContactStatus.NEW,
          priority: contact.priority || ContactPriority.MEDIUM,
          userId: user.id,
        },
      });
      
      imported++;
    } catch (error) {
      console.error(`Failed to import contact ${contact.name}:`, error);
      failed++;
    }
  }
  
  return { imported, failed, existing };
}

/**
 * Generate networking statistics
 */
export async function getNetworkingStats(): Promise<any> {
  const user = await getCurrentUser();
  
  const [
    totalContacts,
    activeContacts,
    contactsBySource,
    contactsByStatus,
    pendingReminders,
    interactionCounts,
  ] = await Promise.all([
    // Total contacts
    db.networkContact.count({
      where: {
        userId: user.id,
      },
    }),
    
    // Active contacts (with status not INACTIVE)
    db.networkContact.count({
      where: {
        userId: user.id,
        status: {
          not: ContactStatus.INACTIVE,
        },
      },
    }),
    
    // Contacts by source
    db.networkContact.groupBy({
      by: ['source'],
      where: {
        userId: user.id,
      },
      _count: true,
    }),
    
    // Contacts by status
    db.networkContact.groupBy({
      by: ['status'],
      where: {
        userId: user.id,
      },
      _count: true,
    }),
    
    // Pending reminders
    db.networkReminder.count({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
    }),
    
    // Interactions by month
    db.$queryRaw`
      SELECT
        DATE_TRUNC('month', date) as month,
        COUNT(*) as count
      FROM "ContactInteraction"
      WHERE "userId" = ${user.id}
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `,
  ]);
  
  // Format contacts by source
  const contactsBySourceMap: Record<ContactSource, number> = Object.values(ContactSource).reduce(
    (acc, source) => {
      acc[source] = 0;
      return acc;
    },
    {} as Record<ContactSource, number>
  );
  
  contactsBySource.forEach((item: any) => {
    contactsBySourceMap[item.source as ContactSource] = item._count;
  });
  
  // Format contacts by status
  const contactsByStatusMap: Record<ContactStatus, number> = Object.values(ContactStatus).reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<ContactStatus, number>
  );
  
  contactsByStatus.forEach((item: any) => {
    contactsByStatusMap[item.status as ContactStatus] = item._count;
  });
  
  // Get counts for specific metrics
  const newContacts = contactsByStatusMap[ContactStatus.NEW] || 0;
  const referrals = contactsByStatusMap[ContactStatus.REFERRED] || 0;
  const meetingsScheduled = contactsByStatusMap[ContactStatus.MEETING_SCHEDULED] || 0;
  
  // Format interactions by month
  const interactionsByMonth = interactionCounts.map((item: any) => ({
    month: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    count: Number(item.count),
  }));
  
  return {
    totalContacts,
    activeContacts,
    newContacts,
    referrals,
    meetingsScheduled,
    pendingReminders,
    contactsBySource: contactsBySourceMap,
    contactsByStatus: contactsByStatusMap,
    interactionsByMonth,
  };
}
