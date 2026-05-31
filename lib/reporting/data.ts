import {
  ApplicationSubmission,
  JobLead,
  JobListing,
  JobSearch,
  Prisma,
  Resume,
  ResumeRevision,
} from '@/generated/prisma/browser';

import { db } from '@/lib/db/client';
import { buildPrismaQuery } from '@/lib/db/query';
import { ApiQuery } from '@/types/reporting/query';
import { A11Y_TEST_JOB_SEARCHES, isA11yTestMode } from '@/lib/a11y/test-mode';

export type GetReportDataOptions = {
  cacheKey?: string;
  userId: string;
} & (
  | {
      apiQuery: ApiQuery<JobLead, Prisma.JobLeadInclude>;
      include?: Prisma.JobLeadInclude;
      model: 'job-leads';
    }
  | {
      apiQuery: ApiQuery<JobListing, Prisma.JobListingInclude>;
      include?: Prisma.JobListingInclude;
      model: 'job-listings';
    }
  | {
      apiQuery: ApiQuery<JobSearch, Prisma.JobSearchInclude>;
      include?: Prisma.JobSearchInclude;
      model: 'job-searches';
    }
  | {
      apiQuery: ApiQuery<Resume, Prisma.ResumeInclude>;
      include?: Prisma.ResumeInclude;
      model: 'resumes';
    }
  | {
      apiQuery: ApiQuery<ResumeRevision, Prisma.ResumeRevisionInclude>;
      include?: Prisma.ResumeRevisionInclude;
      model: 'resume-revisions';
    }
  | {
      apiQuery: ApiQuery<
        ApplicationSubmission,
        Prisma.ApplicationSubmissionInclude
      >;
      include?: Prisma.ApplicationSubmissionInclude;
      model: 'applications';
    }
);

export async function getReportData({
  model,
  apiQuery,
  cacheKey,
  userId,
}: { cacheKey?: string; userId: string } & (
  | {
      apiQuery: ApiQuery<JobLead, Prisma.JobLeadInclude>;
      model: 'job-leads';
    }
  | {
      apiQuery: ApiQuery<JobListing, Prisma.JobListingInclude>;
      model: 'job-listings';
    }
  | {
      apiQuery: ApiQuery<JobSearch, Prisma.JobSearchInclude>;
      model: 'job-searches';
    }
  | {
      apiQuery: ApiQuery<Resume, Prisma.ResumeInclude>;
      model: 'resumes';
    }
  | {
      apiQuery: ApiQuery<
        ApplicationSubmission,
        Prisma.ApplicationSubmissionInclude
      >;
      model: 'applications';
    }
)): Promise<{
  data: Array<
    JobLead | JobListing | JobSearch | Resume | ApplicationSubmission
  >;
  pagination: {
    total: number;
  };
}> {
  // 'use cache';

  // cacheTag(`user:${userId}:report:${model}${cacheKey ? `:${cacheKey}` : ''}`);

  if (isA11yTestMode) {
    if (model === 'job-searches') {
      const records = A11Y_TEST_JOB_SEARCHES.filter(search => search.userId === userId);

      return {
        data: records as unknown as Array<JobSearch>,
        pagination: {
          total: records.length,
        },
      };
    }

    return {
      data: [],
      pagination: {
        total: 0,
      },
    };
  }

  switch (model) {
    case 'job-leads': {
      const prismaQuery = buildPrismaQuery<JobLead, Prisma.JobLeadInclude>({
        ...apiQuery,
        include: {
          ...apiQuery.include,
          applicationSubmissions: true,
          jobFitAnalysis: true,
          jobListing: true,
          optimization: {
            include: {
              resumeRevision: true,
            },
          },
        },
      });

      const [data, count] = await Promise.all([
        db.jobLead.findMany(prismaQuery),
        db.jobLead.count({ where: prismaQuery.where }),
      ]);

      return {
        data: data as Array<JobLead>,
        pagination: {
          total: count,
        },
      };
    }
    case 'job-listings': {
      const prismaQuery = buildPrismaQuery<
        JobListing,
        Prisma.JobListingInclude
      >(apiQuery);

      const [data, count] = await Promise.all([
        db.jobListing.findMany(prismaQuery),
        db.jobListing.count({ where: prismaQuery.where }),
      ]);

      return {
        data: data as Array<JobListing>,
        pagination: {
          total: count,
        },
      };
    }
    case 'job-searches': {
      const prismaQuery = buildPrismaQuery<JobSearch, Prisma.JobSearchInclude>({
        ...apiQuery,
        include: {
          jobSearchListings: {
            select: {
              jobListingId: true,
            },
          },
        },
      });

      const [data, count] = await Promise.all([
        db.jobSearch.findMany(prismaQuery),
        db.jobSearch.count({ where: prismaQuery.where }),
      ]);

      return {
        data: data as Array<JobSearch>,
        pagination: {
          total: count,
        },
      };
    }
    case 'resumes': {
      const prismaQuery = buildPrismaQuery<Resume, Prisma.ResumeInclude>({
        ...apiQuery,
        include: {
          ...apiQuery.include,
          analysis: true, // TODO: Do I need this?
          optimization: {
            include: {
              analysis: true,
              resumeRevision: true,
            },
          },
        },
        sort: [{ direction: 'desc', field: 'createdAt' }],
      });

      const [data, count] = await Promise.all([
        db.resume.findMany(prismaQuery),
        db.resume.count({ where: prismaQuery.where }),
      ]);

      return {
        data: data as Array<Resume>,
        pagination: {
          total: count,
        },
      };
    }
    case 'applications': {
      // Applications report: one row per JobLead. Retry chains for the same
      // job collapse to a single row whose status reflects the latest
      // attempt. Two-step query so pagination + sort stay correct:
      //   1. groupBy jobLeadId scoped to this user, sorted by latest
      //      activity, paginated → list of jobLeadIds for the page.
      //   2. findMany distinct on jobLeadId, ordered so the latest
      //      submission wins, then re-order to match the page order.
      const prismaQuery = buildPrismaQuery<
        ApplicationSubmission,
        Prisma.ApplicationSubmissionInclude
      >({
        ...apiQuery,
        include: {
          ...apiQuery.include,
          jobLead: {
            include: { jobListing: true },
          },
          resume: true,
        },
      });
      const where = { ...(prismaQuery.where ?? {}), userId };
      const take = prismaQuery.take ?? 10;
      const skip = prismaQuery.skip ?? 0;

      const [totalGroups, pageGroups] = await Promise.all([
        db.applicationSubmission
          .groupBy({ by: ['jobLeadId'], where })
          .then(groups => groups.length),
        db.applicationSubmission.groupBy({
          by: ['jobLeadId'],
          where,
          _max: { createdAt: true },
          orderBy: { _max: { createdAt: 'desc' } },
          skip,
          take,
        }),
      ]);

      const orderedJobLeadIds = pageGroups.map(g => g.jobLeadId);
      const rows =
        orderedJobLeadIds.length === 0
          ? []
          : await db.applicationSubmission.findMany({
              where: { userId, jobLeadId: { in: orderedJobLeadIds } },
              distinct: ['jobLeadId'],
              include: prismaQuery.include,
              orderBy: [{ jobLeadId: 'asc' }, { createdAt: 'desc' }],
            });

      const byJobLead = new Map(rows.map(r => [r.jobLeadId, r]));
      const data = orderedJobLeadIds
        .map(id => byJobLead.get(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r));

      return {
        data: data as Array<ApplicationSubmission>,
        pagination: { total: totalGroups },
      };
    }
    default:
      throw new Error(`Model ${model} not found`);
  }
}
