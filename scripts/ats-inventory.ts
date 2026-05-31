import 'dotenv/config';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { JobProvider } from '@/generated/prisma/browser';
import {
  type AtsAutomationPosture,
  type AtsFamily,
  classifyAtsFamily,
} from '@/lib/applications/services/platform-detection';
import { db } from '@/lib/db/client';
import { normalizeApplyOptions } from '@/lib/job-listings/normalize-apply-options';

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_MIN_JOBS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const POSTURE_RANK: Record<AtsAutomationPosture, number> = {
  ALLOWED: 3,
  FORBIDDEN: 1,
  GRAY: 2,
};

interface RecentJobListing {
  applyOptions: unknown;
  company: string | null;
  createdAt: Date;
  description: string | null;
  jobProvider: JobProvider | null;
  jobProviderUrl: string | null;
  postedAt: Date | null;
  source: string | null;
  title: string;
}

interface AtsInventoryOptions {
  minJobs: number;
  outputPath: string;
  since: Date;
}

interface AtsInventoryExample {
  company: string;
  hostname: string;
  title: string;
  url: string;
}

interface AtsFamilyStats {
  examples: AtsInventoryExample[];
  family: AtsFamily;
  hostnames: Map<string, number>;
  posture: AtsAutomationPosture;
  recentJobs: number;
  recentSoftwareEngineeringJobs: number;
  sources: Map<string, number>;
}

function parseArgs(args: string[]): AtsInventoryOptions {
  const today = new Date().toISOString().slice(0, 10);
  let days = DEFAULT_WINDOW_DAYS;
  let minJobs = DEFAULT_MIN_JOBS;
  let outputPath = path.join('docs', `ats-inventory-${today}.md`);
  let since: Date | null = null;

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      days = Number.parseInt(arg.slice('--days='.length), 10);
      continue;
    }

    if (arg.startsWith('--min-jobs=')) {
      minJobs = Number.parseInt(arg.slice('--min-jobs='.length), 10);
      continue;
    }

    if (arg.startsWith('--output=')) {
      outputPath = arg.slice('--output='.length);
      continue;
    }

    if (arg.startsWith('--since=')) {
      since = new Date(arg.slice('--since='.length));
    }
  }

  if (!Number.isFinite(days) || days < 1) {
    throw new Error('--days must be a positive integer');
  }

  if (!Number.isFinite(minJobs) || minJobs < 1) {
    throw new Error('--min-jobs must be a positive integer');
  }

  const resolvedSince = since ?? new Date(Date.now() - days * DAY_MS);
  if (Number.isNaN(resolvedSince.getTime())) {
    throw new Error('--since must be a valid date');
  }

  return {
    minJobs,
    outputPath,
    since: resolvedSince,
  };
}

function extractApplyUrls(job: RecentJobListing): string[] {
  const urls = normalizeApplyOptions(job.applyOptions).map(
    option => option.link,
  );
  if (job.jobProviderUrl) {
    urls.push(job.jobProviderUrl);
  }

  return [...new Set(urls.map(url => url.trim()).filter(Boolean))];
}

function hostnameFromUrl(url: string | null): string {
  if (!url) {
    return 'unknown';
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'invalid-url';
  }
}

function isSoftwareEngineeringJob(job: RecentJobListing): boolean {
  const haystack = `${job.title} ${job.description ?? ''}`.toLowerCase();
  return [
    'software engineer',
    'software developer',
    'swe',
    'frontend',
    'front-end',
    'backend',
    'back-end',
    'full stack',
    'fullstack',
    'web platform',
    'platform engineer',
    'site reliability',
    'sre',
    'devops',
    'mobile engineer',
    'ios engineer',
    'android engineer',
    'embedded',
    'systems engineer',
    'data engineer',
    'machine learning engineer',
    'ml engineer',
    'qa engineer',
    'test engineer',
    'application developer',
  ].some(keyword => haystack.includes(keyword));
}

function detectAtsForJob(job: RecentJobListing): {
  family: AtsFamily | null;
  hostname: string;
  posture: AtsAutomationPosture | null;
  url: string;
} {
  const urls = extractApplyUrls(job);
  const providerDetection = classifyAtsFamily({
    content: job.description,
    jobProvider: job.jobProvider,
    url: urls[0],
  });

  if (providerDetection.family) {
    const url = urls[0] ?? job.jobProviderUrl ?? '';
    return {
      family: providerDetection.family,
      hostname: hostnameFromUrl(url) || providerDetection.family,
      posture: providerDetection.posture,
      url,
    };
  }

  for (const url of urls) {
    const detection = classifyAtsFamily({
      content: job.description,
      url,
    });
    if (detection.family) {
      return {
        family: detection.family,
        hostname: hostnameFromUrl(url),
        posture: detection.posture,
        url,
      };
    }
  }

  const contentDetection = classifyAtsFamily({
    content: job.description,
  });

  return {
    family: contentDetection.family,
    hostname: contentDetection.family ?? 'unknown',
    posture: contentDetection.posture,
    url: urls[0] ?? job.jobProviderUrl ?? '',
  };
}

function addMapCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntries(map: Map<string, number>, limit: number): string {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => `${value} (${count})`)
    .join(', ');
}

function tableCell(value: number | string): string {
  return String(value).replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

async function collectInventory(since: Date): Promise<AtsFamilyStats[]> {
  const jobs = await db.jobListing.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      applyOptions: true,
      company: true,
      createdAt: true,
      description: true,
      jobProvider: true,
      jobProviderUrl: true,
      postedAt: true,
      source: true,
      title: true,
    },
    where: {
      OR: [
        {
          createdAt: {
            gte: since,
          },
        },
        {
          postedAt: {
            gte: since,
          },
        },
      ],
    },
  });

  const stats = new Map<AtsFamily, AtsFamilyStats>();

  for (const job of jobs) {
    const detection = detectAtsForJob(job);
    if (!detection.family || !detection.posture) {
      continue;
    }

    const familyStats =
      stats.get(detection.family) ??
      ({
        examples: [],
        family: detection.family,
        hostnames: new Map<string, number>(),
        posture: detection.posture,
        recentJobs: 0,
        recentSoftwareEngineeringJobs: 0,
        sources: new Map<string, number>(),
      } satisfies AtsFamilyStats);

    familyStats.recentJobs += 1;
    if (isSoftwareEngineeringJob(job)) {
      familyStats.recentSoftwareEngineeringJobs += 1;
    }

    addMapCount(familyStats.hostnames, detection.hostname);
    addMapCount(
      familyStats.sources,
      job.source ?? job.jobProvider ?? detection.family,
    );

    if (familyStats.examples.length < 5) {
      familyStats.examples.push({
        company: job.company ?? 'Unknown company',
        hostname: detection.hostname,
        title: job.title,
        url: detection.url || 'n/a',
      });
    }

    stats.set(detection.family, familyStats);
  }

  return [...stats.values()].sort((a, b) => {
    if (b.recentSoftwareEngineeringJobs !== a.recentSoftwareEngineeringJobs) {
      return b.recentSoftwareEngineeringJobs - a.recentSoftwareEngineeringJobs;
    }

    if (b.hostnames.size !== a.hostnames.size) {
      return b.hostnames.size - a.hostnames.size;
    }

    if (POSTURE_RANK[b.posture] !== POSTURE_RANK[a.posture]) {
      return POSTURE_RANK[b.posture] - POSTURE_RANK[a.posture];
    }

    return b.recentJobs - a.recentJobs;
  });
}

function toMarkdown({
  generatedAt,
  minJobs,
  rows,
  since,
}: {
  generatedAt: Date;
  minJobs: number;
  rows: AtsFamilyStats[];
  since: Date;
}): string {
  const filteredRows = rows.filter(row => row.recentJobs >= minJobs);
  const lines = [
    '<!-- markdownlint-disable MD013 MD034 -->',
    '',
    `# ATS Inventory - ${generatedAt.toISOString().slice(0, 10)}`,
    '',
    `Generated: ${generatedAt.toISOString()}`,
    `Recent window starts: ${since.toISOString()}`,
    `Minimum detected jobs: ${minJobs}`,
    '',
    'This report is generated from a read-only `JobListing` query. A job is recent when `createdAt` or `postedAt` falls inside the window. Ranking is by recent software-engineering jobs, then distinct ATS hostnames, then automation posture.',
    '',
    'Posture note: `GRAY` means review is required before automation is promoted. P0.4 records the reviewed ToS URL and final posture.',
    '',
  ];

  if (filteredRows.length === 0) {
    lines.push('No ATS families met the threshold.');
    return `${lines.join('\n')}\n`;
  }

  lines.push(
    '| Rank | ATS family | Candidate posture | Recent jobs | Recent SWE jobs | Distinct hostnames | Top hostnames | Top sources |',
    '| ---: | --- | --- | ---: | ---: | ---: | --- | --- |',
  );

  filteredRows.forEach((row, index) => {
    const cells = [
      index + 1,
      row.family,
      row.posture,
      row.recentJobs,
      row.recentSoftwareEngineeringJobs,
      row.hostnames.size,
      topEntries(row.hostnames, 4) || 'n/a',
      topEntries(row.sources, 4) || 'n/a',
    ];
    lines.push(`| ${cells.map(tableCell).join(' | ')} |`);
  });

  for (const row of filteredRows) {
    lines.push('', `## ${row.family}`, '');
    lines.push(
      `Posture: ${row.posture}. Recent jobs: ${row.recentJobs}. Recent SWE jobs: ${row.recentSoftwareEngineeringJobs}. Distinct hostnames: ${row.hostnames.size}.`,
      '',
      'Examples:',
      '',
    );

    for (const example of row.examples) {
      lines.push(
        `- ${example.title} at ${example.company} - ${example.hostname} - ${example.url}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await collectInventory(options.since);
  const markdown = toMarkdown({
    generatedAt: new Date(),
    minJobs: options.minJobs,
    rows,
    since: options.since,
  });

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, markdown, 'utf8');

  const includedCount = rows.filter(
    row => row.recentJobs >= options.minJobs,
  ).length;
  console.log(
    `Wrote ${options.outputPath} with ${includedCount} ATS families meeting threshold.`,
  );
}

await main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
