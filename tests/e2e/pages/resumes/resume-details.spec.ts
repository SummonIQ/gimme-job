import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
  ResumeAnalysisStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';

const prisma = db;

const AUTH_FILE = '.playwright/.auth/user.json';
const TEST_EMAIL = 'bright-and-early@outlook.com';
const TEST_PASSWORD = '12341234';

const ensureLoggedIn = async (page: Page) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Already authenticated — redirected away from /login
  if (!page.url().includes('/login')) return;

  const form = page.locator('form').first();
  await form.getByRole('textbox', { name: 'Email address' }).fill(TEST_EMAIL);
  await form.getByLabel(/password/i).fill(TEST_PASSWORD);
  await form.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(url => !url.toString().includes('/login'), {
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle');
};

const uniqueSuffix = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('Resume Details Page', () => {
  let userId: string;

  test.beforeAll(async ({ browser }) => {
    // Resolve userId directly from the database — no session API needed
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_EMAIL },
      select: { id: true },
    });
    userId = user.id;

    // Authenticate and persist browser state
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ensureLoggedIn(page);
    await ctx.storageState({ path: AUTH_FILE });
    await page.close();
    await ctx.close();
  });

  test.use({ storageState: AUTH_FILE });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Header ────────────────────────────────────────────────────────

  test('renders page header with resume name, default badge, and actions', async ({
    page,
  }) => {
    const resumeName = `E2E Header ${uniqueSuffix()}`;

    const resume = await prisma.resume.create({
      data: {
        description: 'E2E header fixture',
        markdown: '# Test Resume\n\n- Experience',
        name: resumeName,
        userId,
      },
    });

    try {
      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(resumeName).first()).toBeVisible();
      await expect(page.getByText('Default')).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Original Resume' }),
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Optimized Resume' }),
      ).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  // ── Original Resume Tab ───────────────────────────────────────────

  test('original tab shows description and markdown preview/raw tabs', async ({
    page,
  }) => {
    const resume = await prisma.resume.create({
      data: {
        description: 'A well-crafted software engineer resume',
        markdown:
          '# John Doe\n\n## Experience\n\n- Built scalable APIs\n\n## Skills\n\n- TypeScript\n- React',
        name: `E2E OriginalTab ${uniqueSuffix()}`,
        userId,
      },
    });

    try {
      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText('A well-crafted software engineer resume'),
      ).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Preview' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Raw' })).toBeVisible();

      // Switch to raw tab and verify content
      await page.getByRole('tab', { name: 'Raw' }).click();
      await expect(page.getByText('Built scalable APIs')).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  test('shows "No preview available" when resume has no markdown', async ({
    page,
  }) => {
    const resume = await prisma.resume.create({
      data: {
        description: 'Resume with no markdown',
        name: `E2E NoMarkdown ${uniqueSuffix()}`,
        userId,
      },
    });

    try {
      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('No preview available yet.')).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  test('shows "No analysis found" when resume has no analysis', async ({
    page,
  }) => {
    const resume = await prisma.resume.create({
      data: {
        description: 'Resume without analysis',
        markdown: '# No Analysis Resume',
        name: `E2E NoAnalysis ${uniqueSuffix()}`,
        userId,
      },
    });

    try {
      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('No analysis found.')).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  // ── Analysis Cards ────────────────────────────────────────────────

  test('renders all analysis cards when analysis data exists', async ({
    page,
  }) => {
    const resume = await prisma.resume.create({
      data: {
        description: 'E2E analysis fixture',
        markdown: '# Analysed Resume',
        name: `E2E Analysis ${uniqueSuffix()}`,
        userId,
      },
    });

    try {
      await prisma.resumeAnalysis.create({
        data: {
          achievements: {
            good_examples: ['Led migration to microservices'],
            needs_improvement: ['Add quantified impact'],
            score: 7,
          },
          formatting: {
            feedback: ['Good use of bullet points'],
            incompatible_elements: ['Tables'],
            score: 8,
          },
          grammar: { issues: [], issues_found: 0, score: 9 },
          keywords: {
            feedback: ['Good keyword density'],
            missing: ['Kubernetes'],
            overused: ['Responsible for'],
            score: 6,
          },
          progress: 100,
          readability: { feedback: ['Clear and concise'], score: 8 },
          recommendations: {
            content_enhancements: ['Add metrics to achievements'],
            long_term_improvements: ['Get AWS certification'],
            priority_fixes: ['Remove objective statement'],
          },
          resumeId: resume.id,
          score: 74,
          sections: {
            details: [
              { feedback: ['Well structured'], name: 'Experience', score: 8 },
            ],
            score: 7,
          },
          spelling: { issues: [], issues_found: 0, score: 10 },
          status: ResumeAnalysisStatus.COMPLETED,
          strengths: ['Clear section structure', 'Strong technical skills'],
          summary: 'Well-structured resume with room for improvement',
          userId,
          weaknesses: ['Lacks quantified achievements'],
        },
      });

      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      // Analysis summary
      await expect(page.getByText('Analysis').first()).toBeVisible();
      await expect(
        page.getByText('Well-structured resume with room for improvement'),
      ).toBeVisible();
      await expect(page.getByText('Clear section structure')).toBeVisible();
      await expect(
        page.getByText('Lacks quantified achievements'),
      ).toBeVisible();

      // Grammar & Spelling
      await expect(page.getByText('Grammar & Spelling').first()).toBeVisible();

      // Keyword Analysis
      await expect(page.getByText('Keyword Analysis')).toBeVisible();
      await expect(page.getByText('Kubernetes')).toBeVisible();

      // Sections Analysis
      await expect(page.getByText('Sections Analysis')).toBeVisible();

      // Formatting & Readability
      await expect(
        page.getByText('Formatting & Readability').first(),
      ).toBeVisible();

      // Achievements
      await expect(page.getByText('Achievements').first()).toBeVisible();
      await expect(
        page.getByText('Led migration to microservices'),
      ).toBeVisible();

      // Recommendations
      await expect(page.getByText('Recommendations')).toBeVisible();
      await expect(page.getByText('Remove objective statement')).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  // ── Optimized Resume Tab ──────────────────────────────────────────

  test('switches to optimized resume tab and shows optimization data', async ({
    page,
  }) => {
    const resume = await prisma.resume.create({
      data: {
        description: 'E2E tab switch fixture',
        markdown: '# Original\n\n- Basic experience',
        name: `E2E TabSwitch ${uniqueSuffix()}`,
        userId,
      },
    });

    try {
      const revision = await prisma.resumeRevision.create({
        data: {
          description: 'Optimized revision',
          markdown: '# Optimized\n\n- Enhanced experience with metrics',
          name: `E2E Revision ${uniqueSuffix()}`,
          resumeId: resume.id,
          userId,
        },
      });

      await prisma.resumeOptimization.create({
        data: {
          changelog: ['Improved impact statements', 'Added technical keywords'],
          progress: 100,
          resumeId: resume.id,
          resumeRevisionId: revision.id,
          score: 92,
          scoreImprovement: 18,
          scorePercentChange: 24,
          significantImprovements: ['Added quantified metrics'],
          status: ResumeOptimizationStatus.COMPLETED,
          summary: 'Comprehensive optimization applied',
          userId,
        },
      });

      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: 'Optimized Resume' }).click();

      await expect(
        page.getByText('Comprehensive optimization applied'),
      ).toBeVisible();
      await expect(page.getByText('Improved impact statements')).toBeVisible();
      await expect(page.getByText('Added technical keywords')).toBeVisible();

      // Improvements card
      await expect(
        page.getByText('Improvements', { exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Added quantified metrics')).toBeVisible();

      // Markdown sub-tabs
      await expect(page.getByRole('tab', { name: 'Preview' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Raw' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Diff' })).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  test('shows error alert when optimization has failed status', async ({
    page,
  }) => {
    const resume = await prisma.resume.create({
      data: {
        description: 'E2E failed optimization fixture',
        markdown: '# Failed Resume',
        name: `E2E FailedOpt ${uniqueSuffix()}`,
        userId,
      },
    });

    try {
      await prisma.resumeOptimization.create({
        data: {
          changelog: [],
          progress: 100,
          resumeId: resume.id,
          significantImprovements: [],
          status: ResumeOptimizationStatus.FAILED,
          summary: 'PDF parsing failed due to corrupted file',
          userId,
        },
      });

      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: 'Optimized Resume' }).click();

      await expect(page.getByText('Resume Optimization Failed')).toBeVisible();
      await expect(
        page.getByText('PDF parsing failed due to corrupted file'),
      ).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  // ── Null-safe Fallbacks ───────────────────────────────────────────

  test('shows in-progress message when analysis has null grammar/spelling', async ({
    page,
  }) => {
    const resume = await prisma.resume.create({
      data: {
        description: 'E2E null grammar fixture',
        markdown: '# Partial Analysis Resume',
        name: `E2E NullGrammar ${uniqueSuffix()}`,
        userId,
      },
    });

    try {
      // Create analysis with null grammar/spelling — page guards against this
      // and shows "in progress" message instead of the full analysis section
      await prisma.resumeAnalysis.create({
        data: {
          achievements: {
            good_examples: [],
            needs_improvement: [],
            score: 5,
          },
          formatting: {
            feedback: [],
            incompatible_elements: [],
            score: 5,
          },
          keywords: { feedback: [], missing: [], overused: [], score: 5 },
          progress: 100,
          readability: { feedback: [], score: 5 },
          recommendations: {
            content_enhancements: [],
            long_term_improvements: [],
            priority_fixes: [],
          },
          resumeId: resume.id,
          score: 50,
          sections: { details: [], score: 5 },
          status: ResumeAnalysisStatus.COMPLETED,
          strengths: ['Basic structure'],
          summary: 'Partial analysis',
          userId,
          weaknesses: ['Incomplete'],
        },
      });

      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      // hasDetailedAnalysis is false when grammar/spelling are null,
      // so page falls through to the "still in progress" branch
      await expect(
        page.getByText('Analysis is still in progress'),
      ).toBeVisible();

      // The Grammar & Spelling card should NOT render
      await expect(page.getByText('Grammar & Spelling')).not.toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });
});
