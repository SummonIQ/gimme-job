/**
 * Standalone SerpAPI job ingestion script.
 * Scrapes Google Jobs via SerpAPI and saves results to the database.
 *
 * Usage: bun scripts/scrape-serpapi-jobs.ts
 *
 * ⚠️  This script ONLY uses SerpAPI (Google Jobs). It does NOT call
 *     Fantastic Jobs / RapidAPI or any other paid provider.
 */

import 'dotenv/config';
import { PrismaClient, JobProvider, JobSearchStatus, JobType } from '@/generated/prisma/browser';
import type { Prisma } from '@/generated/prisma/browser';
import { getJson } from 'serpapi';

const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const USER_ID = 'fBqY3nu5Vh0yvMZLieNpffBUQIiHH1E5'; // bright-and-early@outlook.com
const SERP_API_KEY = process.env.SERP_API_SECRET!;
const MAX_PAGES_PER_QUERY = 5; // google_jobs returns ~10 per page → ~50 per query
const DELAY_BETWEEN_PAGES_MS = 1500;
const DELAY_BETWEEN_QUERIES_MS = 3000;

if (!SERP_API_KEY) {
  console.error('❌ SERP_API_SECRET not set in environment');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Queries — remote software engineering roles, senior/lead/executive
// ---------------------------------------------------------------------------

interface SearchQuery {
  q: string;
  location: string;
  remote: boolean;
}

const QUERIES: SearchQuery[] = [
  // Remote software engineer roles
  { q: 'remote software engineer', location: 'United States', remote: true },
  { q: 'remote senior software engineer', location: 'United States', remote: true },
  { q: 'remote staff software engineer', location: 'United States', remote: true },
  { q: 'remote principal software engineer', location: 'United States', remote: true },

  // Tech lead / engineering management
  { q: 'remote tech lead', location: 'United States', remote: true },
  { q: 'remote engineering manager', location: 'United States', remote: true },
  { q: 'remote senior engineering manager', location: 'United States', remote: true },
  { q: 'remote director of engineering', location: 'United States', remote: true },

  // VP / SVP / executive engineering
  { q: 'remote VP engineering', location: 'United States', remote: true },
  { q: 'remote SVP engineering', location: 'United States', remote: true },
  { q: 'remote CTO', location: 'United States', remote: true },

  // Broader non-remote searches to capture more volume
  { q: 'software engineer', location: 'United States', remote: false },
  { q: 'senior software engineer', location: 'United States', remote: false },
  { q: 'tech lead software', location: 'United States', remote: false },
  { q: 'engineering manager software', location: 'United States', remote: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getJobType(scheduleType?: string): JobType {
  switch (scheduleType) {
    case 'Full-time':
      return JobType.FULL_TIME;
    case 'Part-time':
      return JobType.PART_TIME;
    case 'Full-time and Part-time':
      return JobType.FULL_TIME_AND_PART_TIME;
    default:
      return JobType.UNKNOWN;
  }
}

function parseRelativeTime(text: string): Date | null {
  const match = text.match(/(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*ago/i);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase().replace(/s$/, '');
  const now = new Date();
  switch (unit) {
    case 'second': now.setSeconds(now.getSeconds() - amount); break;
    case 'minute': now.setMinutes(now.getMinutes() - amount); break;
    case 'hour': now.setHours(now.getHours() - amount); break;
    case 'day': now.setDate(now.getDate() - amount); break;
    case 'week': now.setDate(now.getDate() - amount * 7); break;
    case 'month': now.setMonth(now.getMonth() - amount); break;
    case 'year': now.setFullYear(now.getFullYear() - amount); break;
  }
  return now;
}

function mapJobToListing(job: any, searchTerm: string, isRemote: boolean): Prisma.JobListingCreateManyInput {
  const {
    apply_options,
    thumbnail,
    company_name,
    description,
    detected_extensions = {},
    extensions = [],
    job_highlights,
    job_id,
    location: jobLocation,
    share_link,
    title,
    via,
  } = job;

  const {
    posted_at,
    salary,
    schedule_type,
    paid_time_off,
    dental_coverage,
    health_insurance,
    work_from_home,
  } = detected_extensions;

  let qualifications: string[] = [];
  let requirements: string[] = [];
  let benefits: string[] = [];
  let responsibilities: string[] = [];

  if (job_highlights && Array.isArray(job_highlights)) {
    for (const highlight of job_highlights) {
      const hlTitle = highlight.title?.toLowerCase() || '';
      const items = highlight.items || [];
      if (hlTitle.includes('qualif') || hlTitle.includes('skill')) {
        qualifications = [...qualifications, ...items];
      } else if (hlTitle.includes('requir')) {
        requirements = [...requirements, ...items];
      } else if (hlTitle.includes('benefit')) {
        benefits = [...benefits, ...items];
      } else if (hlTitle.includes('respons')) {
        responsibilities = [...responsibilities, ...items];
      }
    }
  }

  const postedAt = posted_at ? parseRelativeTime(posted_at)?.toISOString() : undefined;

  const rawJobId = typeof job_id === 'string' && job_id.trim() ? job_id.trim() : null;
  const rawShareLink = typeof share_link === 'string' && share_link.trim() ? share_link.trim() : null;
  const fallbackId = rawShareLink
    ? rawShareLink
    : `${String(title ?? '').trim()}|${String(company_name ?? '').trim()}|${String(jobLocation ?? '').trim()}|${searchTerm}|${isRemote ? 'remote' : 'local'}`;

  return {
    applyOptions: (apply_options ?? []) as unknown as Prisma.JsonArray,
    benefits: benefits.length > 0 ? benefits : [],
    company: company_name,
    companyLogoUrl: thumbnail ?? undefined,
    dentalCoverage: dental_coverage ?? undefined,
    description: description ?? 'No description provided',
    detectedExtensions: (detected_extensions ?? {}) as unknown as Prisma.JsonObject,
    extensions,
    healthInsurance: health_insurance ?? undefined,
    jobProvider: JobProvider.SERPAPI,
    jobProviderUrl: share_link,
    jobId: rawJobId ?? fallbackId,
    jobType: getJobType(schedule_type),
    location: jobLocation,
    paidTimeOff: paid_time_off ?? undefined,
    postedAt: postedAt ? new Date(postedAt) : null,
    qualifications: qualifications.length > 0 ? qualifications : undefined,
    remote: work_from_home ?? isRemote,
    requirements: requirements.length > 0 ? requirements : undefined,
    responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
    salary,
    scheduleType: schedule_type,
    source: via,
    title,
    userId: USER_ID,
    workFromHome: work_from_home ?? undefined,
  } as Prisma.JobListingCreateManyInput;
}

// ---------------------------------------------------------------------------
// Core: fetch pages for a single query
// ---------------------------------------------------------------------------

async function fetchQueryPages(query: SearchQuery): Promise<Prisma.JobListingCreateManyInput[]> {
  const allListings: Prisma.JobListingCreateManyInput[] = [];
  let nextPageToken: string | undefined;

  for (let page = 1; page <= MAX_PAGES_PER_QUERY; page++) {
    const params: Record<string, string> = {
      engine: 'google_jobs',
      api_key: SERP_API_KEY,
      q: query.q,
      location: query.location,
      google_domain: 'google.com',
      hl: 'en',
    };

    if (query.remote) {
      params.ltype = '1';
    }

    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    try {
      const data = (await getJson(params)) as any;

      if (data.error) {
        const err = String(data.error);
        if (err.toLowerCase().includes("google hasn't returned any results")) {
          console.log(`    Page ${page}: no more results`);
          break;
        }
        console.error(`    Page ${page} error: ${err}`);
        break;
      }

      const jobs = data.jobs_results || [];
      if (jobs.length === 0) {
        console.log(`    Page ${page}: 0 jobs (end of results)`);
        break;
      }

      for (const job of jobs) {
        allListings.push(mapJobToListing(job, query.q, query.remote));
      }

      console.log(`    Page ${page}: ${jobs.length} jobs`);

      nextPageToken = data.serpapi_pagination?.next_page_token;
      if (!nextPageToken) {
        console.log(`    No more pages after page ${page}`);
        break;
      }

      // Rate limit between pages
      if (page < MAX_PAGES_PER_QUERY) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_PAGES_MS));
      }
    } catch (err) {
      console.error(`    Page ${page} failed:`, err instanceof Error ? err.message : err);
      break;
    }
  }

  return allListings;
}

// ---------------------------------------------------------------------------
// DB: save job listings
// ---------------------------------------------------------------------------

async function saveJobListings(
  jobSearchId: string,
  listings: Prisma.JobListingCreateManyInput[],
): Promise<{ created: number; linked: number }> {
  if (listings.length === 0) return { created: 0, linked: 0 };

  const createResult = await db.jobListing.createMany({
    data: listings,
    skipDuplicates: true,
  });

  const jobIds = [...new Set(
    listings
      .map(l => l.jobId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  )];

  if (jobIds.length === 0) return { created: createResult.count, linked: 0 };

  const existing = await db.jobListing.findMany({
    where: { jobId: { in: jobIds }, userId: USER_ID },
    select: { id: true },
  });

  const linkResult = await db.jobSearchListing.createMany({
    data: existing.map(l => ({ jobListingId: l.id, jobSearchId })),
    skipDuplicates: true,
  });

  return { created: createResult.count, linked: linkResult.count };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🔍 SerpAPI Job Ingestion Script');
  console.log(`   ${QUERIES.length} queries, up to ${MAX_PAGES_PER_QUERY} pages each`);
  console.log(`   User: ${USER_ID}`);
  console.log('   ⚠️  SerpAPI only — no Fantastic Jobs / RapidAPI calls\n');

  let grandTotalCreated = 0;
  let grandTotalLinked = 0;

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    const label = `[${i + 1}/${QUERIES.length}] "${query.q}" (${query.location}${query.remote ? ', remote' : ''})`;
    console.log(`\n${label}`);

    // Create a JobSearch record for tracking
    const jobSearch = await db.jobSearch.create({
      data: {
        searchTerm: query.q,
        location: query.location,
        remote: query.remote,
        jobProvider: JobProvider.SERPAPI,
        status: JobSearchStatus.PROCESSING,
        progress: 0,
        user: { connect: { id: USER_ID } },
      },
    });

    try {
      const listings = await fetchQueryPages(query);
      console.log(`  → Fetched ${listings.length} total listings`);

      const { created, linked } = await saveJobListings(jobSearch.id, listings);
      console.log(`  → DB: ${created} new, ${linked} linked to search`);

      grandTotalCreated += created;
      grandTotalLinked += linked;

      await db.jobSearch.update({
        where: { id: jobSearch.id },
        data: {
          status: JobSearchStatus.COMPLETED,
          completedAt: new Date(),
          endedAt: new Date(),
          progress: 100,
          totalJobs: linked,
        },
      });
    } catch (err) {
      console.error(`  ❌ Query failed:`, err instanceof Error ? err.message : err);
      await db.jobSearch.update({
        where: { id: jobSearch.id },
        data: {
          status: JobSearchStatus.FAILED,
          endedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    }

    // Rate limit between queries
    if (i < QUERIES.length - 1) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_QUERIES_MS / 1000}s before next query...`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_QUERIES_MS));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Done! ${grandTotalCreated} new jobs created, ${grandTotalLinked} linked to searches`);
  console.log('='.repeat(60));

  await db.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  db.$disconnect();
  process.exit(1);
});
