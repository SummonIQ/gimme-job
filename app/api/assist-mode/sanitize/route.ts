import * as cheerio from 'cheerio';
import { NextResponse, type NextRequest } from 'next/server';

import { generateAIText } from '@/lib/ai';
import { getServerAiProvider } from '@/lib/ai/provider';
import { loadChromium } from '@/lib/browser/playwright-runtime';
import { getCurrentUser } from '@/lib/user/query';

const requestHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

const MAX_HTML_CHARS = 120000;
const MAX_STYLE_CHARS = 30000;

const buildPrompt = ({
  url,
  method,
  html,
  styles,
}: {
  url: string;
  method: string;
  html: string;
  styles: string;
}) => `You are an expert at simplifying job application pages.

Your task:
- Produce a simplified, accessible HTML fragment that highlights the fields a candidate must fill out.
- Preserve form action and method attributes exactly as provided.
- Keep all relevant input/select/textarea elements with their name, id, type, required, placeholder, and value attributes.
- Use clear labels and group fields into logical sections.
- Keep buttons or links that continue the application flow (Next, Continue, Submit).
- Do not include scripts or external assets.
- Identify the single best next action for the candidate.
- Add data-assist-action="primary" and data-assist-reason="..." to the element for that action.
  - Keep the reason under 120 characters and written in plain language.
- Output ONLY the HTML fragment (no markdown, no code fences, no <html>/<head>/<body> tags).

Application URL: ${url}
Form method hint: ${method}

Styles (for context):
${styles}

HTML:
${html}
`;

const stripCodeFence = (value: string) =>
  value.replace(/```[a-z]*\n?|```/gi, '').trim();

const getPageHtml = async (url: string) => {
  const chromium = await loadChromium();
  if (!chromium) {
    // No browser available — fall back to a plain fetch. Works for
    // server-rendered pages; SPAs will return the unhydrated shell.
    const response = await fetch(url, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`Fallback fetch failed: ${response.status}`);
    }
    return await response.text();
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await browser.close();
  }
};

const getStyles = ($: cheerio.CheerioAPI) =>
  $('link[rel="stylesheet"], style')
    .toArray()
    .map(element => $.html(element))
    .join('')
    .slice(0, MAX_STYLE_CHARS);

const buildPostBody = (fields: Record<string, string | string[]>) => {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => params.append(key, item));
    } else {
      params.append(key, value);
    }
  });
  return params;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      url?: string;
      method?: string;
      fields?: Record<string, string | string[]>;
    };

    if (!body.url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const method = (body.method || 'GET').toUpperCase();
    const fields = body.fields ?? {};

    let rawHtml = '';

    if (method === 'GET') {
      const targetUrl = new URL(parsedUrl.toString());
      Object.entries(fields).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => targetUrl.searchParams.append(key, item));
        } else {
          targetUrl.searchParams.append(key, value);
        }
      });
      rawHtml = await getPageHtml(targetUrl.toString());
    } else {
      const response = await fetch(parsedUrl.toString(), {
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: buildPostBody(fields),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to submit form (${response.status})` },
          { status: 502 },
        );
      }

      rawHtml = await response.text();
    }

    const $ = cheerio.load(rawHtml);
    $('script, noscript, iframe').remove();

    const styles = getStyles($);
    const html = $.html().slice(0, MAX_HTML_CHARS);

    const prompt = buildPrompt({
      url: parsedUrl.toString(),
      method,
      html,
      styles,
    });

    const aiProvider = await getServerAiProvider();
    const simplified = await generateAIText(prompt, {
      aiProvider,
      temperature: 0.2,
    });

    return NextResponse.json({ html: stripCodeFence(simplified) });
  } catch (error) {
    console.error('Assist mode sanitize error:', error);
    return NextResponse.json(
      { error: 'Failed to generate sanitized view' },
      { status: 500 },
    );
  }
}
