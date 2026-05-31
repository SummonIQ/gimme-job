import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeKeywordEffectiveness } from '../keyword-analysis';
import { db } from '@/lib/db/client';
import { ApplicationStatus } from '@/generated/prisma/browser';

// Mock the database
vi.mock('@/lib/db/client', () => ({
  db: {
    applicationSubmission: {
      findMany: vi.fn(),
    },
  },
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  cacheTag: vi.fn(),
}));

describe('Keyword Analysis', () => {
  const mockUserId = 'user-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeKeywordEffectiveness', () => {
    it('should return empty array when applications are below minimum threshold', async () => {
      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue([
        createMockApplication({ id: '1', status: ApplicationStatus.SUBMITTED }),
        createMockApplication({ id: '2', status: ApplicationStatus.SUBMITTED }),
      ]);

      const result = await analyzeKeywordEffectiveness(mockUserId, { minApplications: 5 });

      expect(result).toEqual([]);
    });

    it('should calculate response rates correctly', async () => {
      const applications = [
        createMockApplication({ 
          id: '1', 
          status: ApplicationStatus.UNDER_REVIEW,
          resumeContent: 'React Developer with TypeScript experience'
        }),
        createMockApplication({ 
          id: '2', 
          status: ApplicationStatus.INTERVIEW_SCHEDULED,
          resumeContent: 'React Developer with TypeScript experience'
        }),
        createMockApplication({ 
          id: '3', 
          status: ApplicationStatus.OFFER_RECEIVED,
          resumeContent: 'React Developer with TypeScript experience'
        }),
        createMockApplication({ 
          id: '4', 
          status: ApplicationStatus.REJECTED,
          resumeContent: 'React Developer with TypeScript experience'
        }),
        createMockApplication({ 
          id: '5', 
          status: ApplicationStatus.SUBMITTED,
          resumeContent: 'React Developer with TypeScript experience'
        }),
      ];

      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue(applications);

      const result = await analyzeKeywordEffectiveness(mockUserId, { minApplications: 5 });

      const reactKeyword = result.find(k => k.keyword === 'React');
      expect(reactKeyword).toBeDefined();
      expect(reactKeyword?.totalApplications).toBe(5);
      expect(reactKeyword?.responseRate).toBe(60); // 3 out of 5
      expect(reactKeyword?.interviewRate).toBe(40); // 2 out of 5
      expect(reactKeyword?.offerRate).toBe(20); // 1 out of 5
    });

    it('should classify effectiveness correctly', async () => {
      const highPerformingApps = Array.from({ length: 10 }, (_, i) => 
        createMockApplication({ 
          id: `high-${i}`, 
          status: i < 8 ? ApplicationStatus.INTERVIEW_SCHEDULED : ApplicationStatus.SUBMITTED,
          resumeContent: 'Machine Learning and AI expertise'
        })
      );

      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue(highPerformingApps);

      const result = await analyzeKeywordEffectiveness(mockUserId, { minApplications: 5 });

      const mlKeyword = result.find(k => k.keyword === 'Machine Learning');
      expect(mlKeyword?.effectiveness).toBe('high');
    });

    it('should filter by resume ID when provided', async () => {
      const resumeId = 'resume-123';
      
      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue([]);

      await analyzeKeywordEffectiveness(mockUserId, { resumeId });

      expect(db.applicationSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resumeId,
          }),
        })
      );
    });

    it('should filter by date range when provided', async () => {
      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };
      
      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue([]);

      await analyzeKeywordEffectiveness(mockUserId, { dateRange });

      expect(db.applicationSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
          }),
        })
      );
    });

    it('should extract keywords from multiple contexts', async () => {
      const applications = Array.from({ length: 6 }, (_, i) => 
        createMockApplication({ 
          id: `${i}`, 
          status: ApplicationStatus.SUBMITTED,
          resumeContent: `
            Skills: React, TypeScript
            Experience: Worked with React and TypeScript
            Projects: Built React applications
          `
        })
      );

      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue(applications);

      const result = await analyzeKeywordEffectiveness(mockUserId, { minApplications: 5 });

      const reactKeyword = result.find(k => k.keyword === 'React');
      expect(reactKeyword?.contexts).toContain('skills');
      expect(reactKeyword?.contexts).toContain('experience');
      expect(reactKeyword?.contexts).toContain('projects');
    });

    it('should sort results by effectiveness', async () => {
      const applications = [
        ...Array.from({ length: 6 }, (_, i) => 
          createMockApplication({ 
            id: `high-${i}`, 
            status: i < 5 ? ApplicationStatus.OFFER_RECEIVED : ApplicationStatus.SUBMITTED,
            resumeContent: 'Python Developer'
          })
        ),
        ...Array.from({ length: 6 }, (_, i) => 
          createMockApplication({ 
            id: `low-${i}`, 
            status: ApplicationStatus.SUBMITTED,
            resumeContent: 'Java Developer'
          })
        ),
      ];

      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue(applications);

      const result = await analyzeKeywordEffectiveness(mockUserId, { minApplications: 5 });

      // High effectiveness keywords should come first
      const pythonIndex = result.findIndex(k => k.keyword === 'Python');
      const javaIndex = result.findIndex(k => k.keyword === 'Java');
      
      expect(pythonIndex).toBeLessThan(javaIndex);
    });

    it('should handle applications without resume content', async () => {
      const applications = [
        createMockApplication({ id: '1', resumeContent: null }),
        createMockApplication({ id: '2', resumeContent: 'React Developer' }),
        createMockApplication({ id: '3', resumeContent: 'React Developer' }),
        createMockApplication({ id: '4', resumeContent: 'React Developer' }),
        createMockApplication({ id: '5', resumeContent: 'React Developer' }),
        createMockApplication({ id: '6', resumeContent: 'React Developer' }),
      ];

      vi.mocked(db.applicationSubmission.findMany).mockResolvedValue(applications);

      const result = await analyzeKeywordEffectiveness(mockUserId, { minApplications: 5 });

      const reactKeyword = result.find(k => k.keyword === 'React');
      expect(reactKeyword?.totalApplications).toBe(5); // Should only count apps with content
    });
  });
});

// Helper function to create mock applications
function createMockApplication({ 
  id, 
  status = ApplicationStatus.SUBMITTED,
  resumeContent = 'Sample resume content'
}: { 
  id: string; 
  status?: ApplicationStatus;
  resumeContent?: string | null;
}) {
  return {
    createdAt: new Date(),
    daysSinceSubmission: null,
    daysToFinalOutcome: null,
    daysToResponse: null,
    errorMessage: null,
    finalOutcomeAt: null,
    id,
    interviewCount: 0,
    jobLeadId: 'lead-123',
    lastStatusChangeAt: null,
    metadata: {},
    responseReceivedAt: null,
    resumeId: 'resume-123',
    status,
    submissionUrl: null,
    submittedAt: null,
    updatedAt: new Date(),
    userAgent: null,
    userId: 'user-123',
    wasAutomated: false,
    resume: resumeContent ? {
      analysis: null,
      id: 'resume-123',
      json: null,
      markdown: resumeContent,
    } : null,
    jobLead: {
      id: 'lead-123',
      jobListing: {
        company: 'Tech Corp',
        description: 'Job description',
        id: 'listing-123',
        title: 'Software Engineer',
      },
    },
  };
}
