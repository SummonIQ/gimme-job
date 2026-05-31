import { NextResponse, type NextRequest } from 'next/server';

import {
  PlaywrightUnavailableError,
  requireChromium,
} from '@/lib/browser/playwright-runtime';
import { db } from '@/lib/db/client';
import { buildApplicationResumeFileName } from '@/lib/resumes/file-naming';
import { getCurrentUser } from '@/lib/user/query';

const requestHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

const ASHBY_FILE_INPUT_SELECTOR =
  '.ashby-application-form-autofill-input-base-layer input[type="file"], input[type="file"]';
const ASHBY_UPLOAD_HANDLE_PATH =
  '/api/non-user-graphql?op=ApiCreateFileUploadHandle';

function getFileExtension(resumeUrl: string): string {
  const normalizedUrl = resumeUrl.toLowerCase();

  if (normalizedUrl.includes('.docx')) {
    return 'docx';
  }

  if (normalizedUrl.includes('.doc')) {
    return 'docx';
  }

  return 'pdf';
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { url?: string };
    if (!body.url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const resume = user.defaultResumeId
      ? await db.resume.findUnique({
          where: { id: user.defaultResumeId },
          include: {
            revisions: {
              where: user.defaultRevisionId
                ? { id: user.defaultRevisionId }
                : undefined,
              orderBy: { createdAt: 'desc' },
              take: user.defaultRevisionId ? 1 : 0,
            },
          },
        })
      : null;

    const revision = resume?.revisions?.[0];
    const resumeUrl = user.defaultRevisionId
      ? revision?.pdfDocumentUrl || resume?.url
      : resume?.url;

    if (!resumeUrl) {
      return NextResponse.json(
        { error: 'Default resume file is unavailable' },
        { status: 404 },
      );
    }

    const fileName = buildApplicationResumeFileName({
      extension: getFileExtension(resumeUrl),
      firstName: user.firstName,
      lastName: user.lastName,
    });

    const resumeResponse = await fetch(resumeUrl);
    if (!resumeResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch default resume' },
        { status: 502 },
      );
    }

    const buffer = Buffer.from(await resumeResponse.arrayBuffer());
    const contentType =
      resumeResponse.headers.get('content-type') || 'application/pdf';

    const chromium = await requireChromium('Resume upload via assist mode');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const context = await browser.newContext({
        userAgent: requestHeaders['User-Agent'],
      });
      const page = await context.newPage();

      try {
        await page.goto(parsedUrl.toString(), {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
      } catch {
        await page.goto(parsedUrl.toString(), {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
      }

      await page.waitForSelector(ASHBY_FILE_INPUT_SELECTOR, {
        state: 'attached',
        timeout: 15000,
      });

      const input = page.locator(ASHBY_FILE_INPUT_SELECTOR).first();
      await input.scrollIntoViewIfNeeded();

      const uploadHandleResponse = page.waitForResponse(
        response =>
          response.url().includes(ASHBY_UPLOAD_HANDLE_PATH) &&
          response.request().method() === 'POST' &&
          response.ok(),
        { timeout: 15000 },
      );

      await input.setInputFiles({
        buffer,
        mimeType: contentType,
        name: fileName,
      });

      await uploadHandleResponse.catch(() => null);
      await page.waitForLoadState('networkidle').catch(() => null);
      await page.waitForTimeout(2500);

      return NextResponse.json({
        uploaded: true,
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (error instanceof PlaywrightUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 },
      );
    }
    console.error('Assist mode upload default resume error:', error);
    return NextResponse.json(
      { error: 'Failed to upload default resume' },
      { status: 500 },
    );
  }
}
