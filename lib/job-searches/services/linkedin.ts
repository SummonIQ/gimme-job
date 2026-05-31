import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { JobProvider } from '@/generated/prisma/browser';
import type { SerpApiJobSearchResultsResponse } from '@/types/api/serp-api';
import { createJobSearchListings } from '@/lib/job-searches/services/job-search-listings';

/**
 * Scrape LinkedIn job listings for a given search term and location.
 * This is a basic implementation and may need to be adapted for LinkedIn's current markup and anti-bot measures.
 */
export async function scrapeLinkedInListings({
  jobSearchId,
  searchTerm,
  location,
  pageDelay = 5000,
  totalPages = 1,
}: {
  jobSearchId: string;
  searchTerm: string;
  location?: string;
  pageDelay?: number;
  totalPages?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not found');

  const serpApiKey = process.env.SERP_API_SECRET;
  if (!serpApiKey) {
    throw new Error('SERP_API_SECRET is not defined in environment variables.');
  }

  let nextPageToken: string | undefined = undefined;
  let totalJobListings = 0;

  for (let page = 1; page <= totalPages; page++) {
    let url = `https://serpapi.com/search.json?engine=linkedin_jobs&q=${encodeURIComponent(searchTerm)}&api_key=${serpApiKey}`;
    if (location) {
      url += `&location=${encodeURIComponent(location)}`;
    }
    if (nextPageToken) {
      url += `&next_page_token=${nextPageToken}`;
    }

    const response = await fetch(url);
    const data: SerpApiJobSearchResultsResponse = await response.json();

    if (data.jobs_results && Array.isArray(data.jobs_results)) {
      const jobListings = data.jobs_results.map((job) => ({
        title: job.title,
        company: job.company_name,
        location: job.location,
        url: job.share_link || (job.job_id ? `https://www.linkedin.com/jobs/view/${job.job_id}` : undefined),
        description: job.description,
        jobProvider: JobProvider.LINKEDIN,
        userId: user.id,
        jobId: job.job_id,
      }));
      const { linkedCount } = await createJobSearchListings({
        jobListings,
        jobSearchId,
        userId: user.id,
      });
      totalJobListings += linkedCount;
    }

    nextPageToken = data?.serpapi_pagination?.next_page_token;
    if (!nextPageToken) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pageDelay));
  }

  await db.jobSearch.update({
    data: { completedAt: new Date(), endedAt: new Date(), progress: 100 },
    where: { id: jobSearchId },
  });

  return totalJobListings;
}
