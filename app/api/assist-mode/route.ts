import { getCurrentUser } from '@/lib/user/query';
import { NextResponse, type NextRequest } from 'next/server';

import { buildAssistModeSnapshot } from '@/app/api/assist-mode/_lib/build-assist-mode-snapshot';
import { db } from '@/lib/db/client';

const requestHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

interface AtsResumeConfig {
  resumeAutofillContainerSelector: string;
  resumeFileInputSelector: string;
  resumeUploadApiPath: string | null;
}

async function getAtsResumeConfig(
  hostname: string,
): Promise<AtsResumeConfig | null> {
  const atsSystem = await db.aTSSystem.findFirst({
    where: {
      resumeUploadGatesAutofill: true,
      OR: [{ detectedDomain: hostname }, { domainPatterns: { has: hostname } }],
    },
    select: {
      resumeAutofillContainerSelector: true,
      resumeFieldSelectors: true,
      resumeUploadApiPath: true,
    },
  });

  if (!atsSystem?.resumeAutofillContainerSelector) return null;

  const containerSelector = atsSystem.resumeAutofillContainerSelector;
  const fileInputSelector =
    atsSystem.resumeFieldSelectors.length > 0
      ? atsSystem.resumeFieldSelectors.join(', ')
      : `${containerSelector} input[type="file"], input[type="file"]`;

  return {
    resumeAutofillContainerSelector: containerSelector,
    resumeFileInputSelector: fileInputSelector,
    resumeUploadApiPath: atsSystem.resumeUploadApiPath,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const mobileMode = searchParams.get('mobile') === '1';

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    let rawHtml = '';
    const atsResumeConfig = await getAtsResumeConfig(parsedUrl.hostname);
    const atsResumeUploaded = false;

    // Plain fetch only — no browser process. The "embedded browser" is just
    // a div with HTML/CSS injected into a shadow DOM on the client; it
    // doesn't need (and never needed) a headless Chromium to produce that
    // HTML. We just grab the raw markup, run it through the snapshot
    // sanitizer, and return it for the client to render.
    try {
      const fetchHeaders: Record<string, string> = {
        ...requestHeaders,
      };
      if (mobileMode) {
        fetchHeaders['User-Agent'] =
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      }
      const response = await fetch(parsedUrl.toString(), {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch page (${response.status})` },
          { status: 502 },
        );
      }

      rawHtml = await response.text();
    } catch (fetchErr) {
      console.warn('[AssistMode] Page fetch failed:', fetchErr);
      return NextResponse.json(
        {
          error:
            'Could not load the application preview. The page may be unreachable or blocking automated requests — try opening it directly.',
        },
        { status: 502 },
      );
    }
    const snapshot = await buildAssistModeSnapshot({
      baseUrl: parsedUrl,
      rawHtml,
    });

    return NextResponse.json({
      atsResumeUploaded: atsResumeUploaded || undefined,
      atsResumeAutofillSelector:
        atsResumeConfig?.resumeAutofillContainerSelector || undefined,
      html: snapshot.html,
      styles: snapshot.styles,
    });
  } catch (error) {
    console.error('Assist mode proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to load application preview' },
      { status: 500 },
    );
  }
}
