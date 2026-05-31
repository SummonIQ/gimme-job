export const CACHE_TAGS = (userId?: string) => ({
  REPORT: {
    RESUMES: `user:${userId}:report:resumes`,
  },
  USER: {
    JOB_PREFERENCES: `user:${userId}:job-preferences`,
    PROFILE: `user:${userId}:profile`,
    RESUMES: {
      ALL: `user:${userId}:resumes`,
      BY_ID: (resumeId: string) => `user:${userId}:resumes:${resumeId}`,
      BY_ID_WITH_REVISIONS: (resumeId: string) =>
        `user:${userId}:resumes:${resumeId}:revisions`,
    },
  },
});
