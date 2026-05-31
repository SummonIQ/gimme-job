import {
  ResumeAnalysisStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const prisma = db;

interface SessionPayload {
  user?: {
    id?: string;
  };
}

const getAuthenticatedUserId = async (page: Page) => {
  const response = await page.request.get('/api/auth/get-session');
  if (!response.ok()) {
    throw new Error(`Failed to fetch session: ${response.status()}`);
  }

  const payload = (await response.json()) as SessionPayload;
  const userId = payload.user?.id;

  if (!userId) {
    throw new Error('No authenticated user id in session payload');
  }

  return userId;
};

const buildUniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('Resume Realtime And Diff', () => {
  test.use({ storageState: '.playwright/.auth/user.json' });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('shows a markdown diff tab for optimized resumes', async ({ page }) => {
    const userId = await getAuthenticatedUserId(page);
    const suffix = buildUniqueSuffix();

    const originalMarkdown = [
      '# Jane Candidate',
      '',
      '## Experience',
      '- Built internal tools',
      '',
      '## Skills',
      '- React',
    ].join('\n');

    const optimizedMarkdown = [
      '# Jane Candidate',
      '',
      '## Experience',
      '- Built internal tools used by 200+ teammates',
      '- Reduced reporting time by 35%',
      '',
      '## Skills',
      '- React',
      '- TypeScript',
      '- SQL',
    ].join('\n');

    const resume = await prisma.resume.create({
      data: {
        description: 'E2E diff fixture',
        markdown: originalMarkdown,
        name: `E2E Resume Diff ${suffix}`,
        userId,
      },
    });

    try {
      const revision = await prisma.resumeRevision.create({
        data: {
          description: 'E2E optimized revision',
          markdown: optimizedMarkdown,
          name: `E2E Resume Diff Revision ${suffix}`,
          resumeId: resume.id,
          userId,
        },
      });

      await prisma.resumeOptimization.create({
        data: {
          changelog: [
            'Expanded quantified impact in experience section',
            'Added missing technical keywords',
          ],
          progress: 100,
          resumeId: resume.id,
          resumeRevisionId: revision.id,
          score: 88,
          scoreImprovement: 14,
          scorePercentChange: 19,
          significantImprovements: [
            'Added quantified impact metrics',
            'Added ATS-friendly keywords',
          ],
          status: ResumeOptimizationStatus.COMPLETED,
          summary: 'Improved impact clarity and keyword coverage',
          userId,
        },
      });

      await prisma.resumeAnalysis.create({
        data: {
          progress: 100,
          resumeId: resume.id,
          status: ResumeAnalysisStatus.COMPLETED,
          strengths: ['Clear section structure'],
          summary: 'Fixture analysis',
          userId,
          weaknesses: ['Needs more impact metrics'],
        },
      });

      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: 'Optimized Resume' }).click();
      await expect(page.getByRole('tab', { name: 'Diff' })).toBeVisible();

      await page.getByRole('tab', { name: 'Diff' }).click();

      await expect(page.getByText(/\+\d+ additions/i)).toBeVisible();
      await expect(page.getByText(/-\d+ removals/i)).toBeVisible();
      await expect(page.getByText('Old', { exact: true })).toBeVisible();
      await expect(page.getByText('New', { exact: true })).toBeVisible();
      await expect(page.getByText('Content', { exact: true })).toBeVisible();
      await expect(page.getByText('TypeScript')).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  test('shows realtime progress status for active optimization on resume details', async ({
    page,
  }) => {
    const userId = await getAuthenticatedUserId(page);
    const suffix = buildUniqueSuffix();

    const resume = await prisma.resume.create({
      data: {
        description: 'E2E realtime status fixture',
        markdown: '# Active Resume\n\n- In progress',
        name: `E2E Resume Realtime ${suffix}`,
        userId,
      },
    });

    try {
      await prisma.resumeAnalysis.create({
        data: {
          progress: 45,
          resumeId: resume.id,
          status: ResumeAnalysisStatus.ANALYZING,
          strengths: [],
          summary: 'Running analysis',
          userId,
          weaknesses: [],
        },
      });

      await prisma.resumeOptimization.create({
        data: {
          changelog: [],
          progress: 55,
          resumeId: resume.id,
          significantImprovements: [],
          status: ResumeOptimizationStatus.ANALYZING,
          summary: 'Optimization in progress',
          userId,
        },
      });

      await page.goto(`/profile/resumes/${resume.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByRole('heading', { name: 'Resume optimization in progress' }),
      ).toBeVisible();
      await expect(page.getByText('Live update')).toBeVisible();
      await expect(page.getByText('55% complete')).toBeVisible();
      await expect(page.getByRole('progressbar')).toBeVisible();
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });

  test('shows queue progress percentage in resumes report for active optimization', async ({
    page,
  }) => {
    const userId = await getAuthenticatedUserId(page);
    const suffix = buildUniqueSuffix();
    const resumeName = `E2E Queue Resume ${suffix}`;

    const resume = await prisma.resume.create({
      data: {
        description: 'E2E queue fixture',
        markdown: '# Queue Resume',
        name: resumeName,
        userId,
      },
    });

    try {
      await prisma.resumeOptimization.create({
        data: {
          changelog: [],
          progress: 30,
          resumeId: resume.id,
          significantImprovements: [],
          status: ResumeOptimizationStatus.REVISING,
          summary: 'Revising markdown',
          userId,
        },
      });

      await page.goto('/resumes', {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      const row = page.getByRole('row').filter({ hasText: resumeName }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText('Revising');
      await expect(row).toContainText('30%');
    } finally {
      await prisma.resume.delete({ where: { id: resume.id } });
    }
  });
});
