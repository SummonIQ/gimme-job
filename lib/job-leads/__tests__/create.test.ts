import { db } from '@/lib/db/client';
import {
  JobLeadOptimizationStatus,
  JobLeadStatus,
  JobListingStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJobLead } from '../create';

// Mock dependencies
vi.mock('@/lib/db/client', () => ({
  db: {
    jobListing: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    jobLead: {
      create: vi.fn(),
      update: vi.fn(),
    },
    jobLeadOptimization: {
      update: vi.fn(),
    },
    resume: {
      findFirst: vi.fn(),
    },
    resumeOptimization: {
      create: vi.fn(),
      update: vi.fn(),
    },
    resumeRevision: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/user/query', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/cache/revalidate', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/resumes', () => ({
  getUserResume: vi.fn(),
  optimizeResume: vi.fn(),
}));

vi.mock('@/lib/resumes/revisions', () => ({
  getResumeRevision: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  unauthorized: vi.fn(() => {
    throw new Error('Unauthorized');
  }),
}));

vi.mock('next/server', () => ({
  after: vi.fn(),
}));

vi.mock('@/lib/events/channels', () => ({
  getPrivateUserChannel: vi.fn(),
}));

vi.mock('@/lib/events/data-update', () => ({
  sendDataUpdate: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { revalidateTag } from '@/lib/cache/revalidate';
import { getUserResume } from '@/lib/resumes';
import { getResumeRevision } from '@/lib/resumes/revisions';
import { getCurrentUser } from '@/lib/user/query';
import { after } from 'next/server';

describe('Job Lead Creation', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    defaultResumeId: 'resume-123',
    profile: {
      id: 'profile-123',
      firstName: 'Test',
      lastName: 'User',
    },
  };

  const mockJobListing = {
    company: 'Tech Corp',
    description: 'Job description',
    id: 'listing-123',
    status: JobListingStatus.UNREVIEWED,
    title: 'Senior Software Engineer',
    userId: 'user-123',
  };

  const mockJobLead = {
    id: 'lead-123',
    title: 'Senior Software Engineer',
    userId: 'user-123',
    jobListingId: 'listing-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(db.jobListing.findUnique).mockResolvedValue(mockJobListing as any);
    vi.mocked(getUserResume).mockResolvedValue({
      id: 'resume-123',
      markdown: 'Resume markdown',
      name: 'Default Resume',
    } as any);
    vi.mocked(getResumeRevision).mockResolvedValue(undefined as any);
    vi.mocked(after).mockImplementation(() => undefined);
  });

  describe('createJobLead', () => {
    it('should create a job lead successfully', async () => {
      vi.mocked(db.jobListing.update).mockResolvedValue({
        ...mockJobListing,
        status: JobListingStatus.ADDED_TO_LEADS,
      } as any);

      vi.mocked(db.jobLead.create).mockResolvedValue(mockJobLead as any);

      vi.mocked(db.resumeOptimization.create).mockResolvedValue({
        id: 'optimization-123',
        jobLeadId: 'lead-123',
        userId: 'user-123',
        status: ResumeOptimizationStatus.PROCESSING,
      } as any);

      const result = await createJobLead({ jobListingId: 'listing-123' });

      expect(result).toBeDefined();
      expect(db.jobListing.update).toHaveBeenCalledWith({
        data: { status: JobListingStatus.ADDED_TO_LEADS },
        where: { id: 'listing-123' },
      });
    });

    it('should update job listing status to ADDED_TO_LEADS', async () => {
      vi.mocked(db.jobListing.update).mockResolvedValue({
        ...mockJobListing,
        status: JobListingStatus.ADDED_TO_LEADS,
      } as any);

      vi.mocked(db.jobLead.create).mockResolvedValue(mockJobLead as any);
      vi.mocked(db.resumeOptimization.create).mockResolvedValue({} as any);

      await createJobLead({ jobListingId: 'listing-123' });

      expect(db.jobListing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: JobListingStatus.ADDED_TO_LEADS },
        }),
      );
    });

    it('should create job lead with optimization in QUEUED status', async () => {
      vi.mocked(db.jobListing.update).mockResolvedValue(mockJobListing as any);

      vi.mocked(db.jobLead.create).mockResolvedValue(mockJobLead as any);
      vi.mocked(db.resumeOptimization.create).mockResolvedValue({} as any);

      await createJobLead({ jobListingId: 'listing-123' });

      expect(db.jobLead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          optimization: {
            create: {
              status: JobLeadOptimizationStatus.QUEUED,
              user: { connect: { id: 'user-123' } },
            },
          },
        }),
      });
    });

    it('should create resume optimization in PROCESSING status', async () => {
      vi.mocked(db.jobListing.update).mockResolvedValue(mockJobListing as any);
      vi.mocked(db.jobLead.create).mockResolvedValue(mockJobLead as any);
      vi.mocked(db.resumeOptimization.create).mockResolvedValue({} as any);

      await createJobLead({ jobListingId: 'listing-123' });

      expect(db.resumeOptimization.create).toHaveBeenCalledWith({
        data: {
          jobLead: { connect: { id: 'lead-123' } },
          status: ResumeOptimizationStatus.PROCESSING,
          user: { connect: { id: 'user-123' } },
        },
      });
    });

    it('should revalidate all relevant cache tags', async () => {
      vi.mocked(db.jobListing.update).mockResolvedValue(mockJobListing as any);
      vi.mocked(db.jobLead.create).mockResolvedValue(mockJobLead as any);
      vi.mocked(db.resumeOptimization.create).mockResolvedValue({} as any);

      await createJobLead({ jobListingId: 'listing-123' });

      const expectedTags = [
        'user:user-123:report:job-leads',
        'user:user-123:job-leads',
        'user:user-123:job-leads:count',
        'user:user-123:job-leads:lead-123',
        'user:user-123:report:job-listings',
        'user:user-123:job-listings',
        'user:user-123:job-listings:listing-123',
      ];

      expectedTags.forEach(tag => {
        expect(revalidateTag).toHaveBeenCalledWith(tag);
      });
    });

    it('should copy job listing title to job lead', async () => {
      vi.mocked(db.jobListing.findUnique).mockResolvedValue({
        ...mockJobListing,
        title: 'Custom Job Title',
      } as any);

      vi.mocked(db.jobListing.update).mockResolvedValue({
        ...mockJobListing,
        title: 'Custom Job Title',
      } as any);

      vi.mocked(db.jobLead.create).mockResolvedValue(mockJobLead as any);
      vi.mocked(db.resumeOptimization.create).mockResolvedValue({} as any);

      await createJobLead({ jobListingId: 'listing-123' });

      expect(db.jobLead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Custom Job Title',
          }),
        }),
      );
    });

    it('should throw error when user is not authorized', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null as any);

      await expect(
        createJobLead({ jobListingId: 'listing-123' }),
      ).rejects.toThrow('Unauthorized');
    });

    it('should not throw when no default resume exists', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        ...mockUser,
        defaultResumeId: null,
      } as any);

      vi.mocked(db.jobListing.update).mockResolvedValue(mockJobListing as any);
      vi.mocked(db.jobLead.create).mockResolvedValue(mockJobLead as any);
      vi.mocked(db.resumeOptimization.create).mockResolvedValue({
        id: 'optimization-123',
      } as any);
      vi.mocked(db.jobLead.update).mockResolvedValue({} as any);
      vi.mocked(db.jobLeadOptimization.update).mockResolvedValue({} as any);
      vi.mocked(db.resumeOptimization.update).mockResolvedValue({} as any);

      const result = await createJobLead({ jobListingId: 'listing-123' });

      expect(result).toBeDefined();
      expect(db.jobLead.update).toHaveBeenCalledWith({
        data: { status: JobLeadStatus.ANALYSIS_FAILED },
        where: { id: 'lead-123' },
      });
      expect(db.jobLeadOptimization.update).toHaveBeenCalledWith({
        data: { status: JobLeadOptimizationStatus.FAILED },
        where: { jobLeadId: 'lead-123' },
      });
      expect(db.resumeOptimization.update).toHaveBeenCalledWith({
        data: { status: ResumeOptimizationStatus.FAILED },
        where: { id: 'optimization-123' },
      });
      expect(after).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.jobListing.update).mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        createJobLead({ jobListingId: 'listing-123' }),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
