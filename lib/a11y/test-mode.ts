import { JobSearch, JobSearchStatus, User } from '@/generated/prisma/browser';

export const isA11yTestMode = process.env['A11Y_TEST_MODE'] === 'true';

const stubTimestamp = new Date('2024-01-01T00:00:00Z');

export const A11Y_TEST_USER: User = {
  createdAt: stubTimestamp,
  defaultResumeId: null,
  defaultRevisionId: null,
  email: 'a11y.tester@example.com',
  emailVerified: true,
  firstName: 'A11y',
  id: 'user_a11y_tester',
  image: '/user.png',
  lastName: 'Tester',
  name: 'A11y Tester',
  phone: null,
  phoneVerified: null,
  updatedAt: stubTimestamp,
};

export type A11yJobSearch = JobSearch & {
  jobSearchListings: { jobListingId: string }[];
};

const baseJobSearches: JobSearch[] = [
  {
    completedAt: stubTimestamp,
    createdAt: stubTimestamp,
    endedAt: stubTimestamp,
    id: 'a11y-job-search-1',
    jobProvider: null,
    jobProviderUrl: null,
    location: 'Remote',
    metadata: null,
    nextToken: null,
    pageDelay: 2,
    progress: 100,
    remote: true,
    searchTerm: 'Accessible Frontend Engineer',
    status: JobSearchStatus.COMPLETED,
    totalJobs: 24,
    updatedAt: stubTimestamp,
    userId: A11Y_TEST_USER.id,
  },
  {
    completedAt: null,
    createdAt: new Date('2024-01-08T00:00:00Z'),
    endedAt: null,
    id: 'a11y-job-search-2',
    jobProvider: null,
    jobProviderUrl: null,
    location: 'Austin, TX',
    metadata: null,
    nextToken: null,
    pageDelay: 3,
    progress: 65,
    remote: false,
    searchTerm: 'Product Designer',
    status: JobSearchStatus.IN_PROGRESS,
    totalJobs: 11,
    updatedAt: new Date('2024-01-08T12:00:00Z'),
    userId: A11Y_TEST_USER.id,
  },
];

export const A11Y_TEST_JOB_SEARCHES: A11yJobSearch[] = baseJobSearches.map((search, index) => ({
  ...search,
  jobSearchListings: Array.from({ length: index === 0 ? 2 : 1 }, (_, i) => ({
    jobListingId: `a11y-job-listing-${index + 1}-${i + 1}`,
  })),
})) as A11yJobSearch[];

export const A11Y_TEST_ANALYTICS_OVERVIEW = {
  applicationRate: 55,
  appliedJobs: 12,
  avgJobFitScore: 82,
  interviewRate: 58,
  interviewsScheduled: 7,
  offerRate: 42,
  offersReceived: 3,
  totalJobLeads: 22,
};
