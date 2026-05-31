import * as cheerio from 'cheerio';

const rewriteGlobalSelectors = (css: string) =>
  css
    .replace(/:root\b/g, ':host')
    .replace(/html\s+body\b/g, '.assist-root')
    .replace(/(^|[,{]\s*)html\b(?=[\s.:#[,{>+~]|$)/gm, '$1.assist-root')
    .replace(/(^|[,{]\s*)body\b(?=[\s.:#[,{>+~]|$)/gm, '$1.assist-root');

const sanitizeCSS = (css: string) =>
  rewriteGlobalSelectors(css)
    .replace(
      /position\s*:\s*fixed/gi,
      'position: static; visibility: hidden; height: 0; overflow: hidden',
    )
    .replace(/position\s*:\s*sticky/gi, 'position: relative')
    .replace(/zoom\s*:\s*[^;}{]+/gi, 'zoom: 1')
    .replace(/writing-mode\s*:\s*[^;}{]+/gi, 'writing-mode: horizontal-tb')
    .replace(/text-orientation\s*:\s*[^;}{]+/gi, 'text-orientation: mixed')
    .replace(/transform\s*:\s*[^;}{]+/gi, 'transform: none')
    .replace(
      /transform-origin\s*:\s*[^;}{]+/gi,
      'transform-origin: center top',
    )
    .replace(/column-count\s*:\s*[^;}{]+/gi, 'column-count: auto')
    .replace(/columns\s*:\s*[^;}{]+/gi, 'columns: auto')
    .replace(/\b100vw\b/g, '100%')
    .replace(/\b100vh\b/g, 'auto')
    .replace(/z-index\s*:\s*\d{4,}/g, 'z-index: auto');

const inlineExternalStylesheets = async (
  $: cheerio.CheerioAPI,
  baseUrl: URL,
) => {
  const linkElements = $('link[rel="stylesheet"]').toArray();
  const inlinedStyles: string[] = [];

  await Promise.allSettled(
    linkElements.map(async element => {
      const href = $(element).attr('href');
      if (!href) return;

      let cssUrl: string;
      try {
        cssUrl = new URL(href, baseUrl).toString();
      } catch {
        return;
      }

      try {
        const response = await fetch(cssUrl, {
          headers: { Accept: 'text/css,*/*;q=0.1' },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return;
        const cssText = await response.text();
        inlinedStyles.push(sanitizeCSS(cssText));
        $(element).remove();
      } catch {
        // Keep the original stylesheet tag when we cannot inline it.
      }
    }),
  );

  $('style').each((_, element) => {
    const contents = $(element).html();
    if (contents) {
      $(element).html(sanitizeCSS(contents));
    }
  });

  return inlinedStyles;
};

const removeUnsafeAttributes = ($: cheerio.CheerioAPI) => {
  $(
    '[onload],[onclick],[onerror],[onmouseover],[onmouseenter],[onmouseleave]',
  ).each((_, element) => {
    Object.keys(element.attribs || {}).forEach(attribute => {
      if (attribute.toLowerCase().startsWith('on')) {
        $(element).removeAttr(attribute);
      }
    });
  });
};

const rewriteAssetUrls = ($: cheerio.CheerioAPI, baseUrl: URL) => {
  const toAbsoluteUrl = (value?: string | null) => {
    if (!value) return value;
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return value;
    }
  };

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    $(element).attr('href', toAbsoluteUrl(href));
  });
  $('img[src], video[src], source[src]').each((_, element) => {
    const src = $(element).attr('src');
    $(element).attr('src', toAbsoluteUrl(src));
  });
  $('link[href]').each((_, element) => {
    const href = $(element).attr('href');
    $(element).attr('href', toAbsoluteUrl(href));
  });
  $('form[action]').each((_, element) => {
    const action = $(element).attr('action');
    $(element).attr('action', toAbsoluteUrl(action));
  });
};

interface AssistModeSnapshot {
  html: string;
  styles: string;
}

const buildAssistModeSnapshot = async ({
  baseUrl,
  rawHtml,
}: {
  baseUrl: URL;
  rawHtml: string;
}): Promise<AssistModeSnapshot> => {
  const $ = cheerio.load(rawHtml);

  $('script, noscript, iframe').remove();
  removeUnsafeAttributes($);
  rewriteAssetUrls($, baseUrl);

  const inlinedCssBlocks = await inlineExternalStylesheets($, baseUrl);
  const remainingStyleElements = $('link[rel="stylesheet"], style')
    .toArray()
    .map(element => $.html(element))
    .join('');
  const inlinedStyleTags = inlinedCssBlocks
    .map(css => `<style>${css}</style>`)
    .join('');

  return {
    html: $('body').html() ?? '',
    styles: inlinedStyleTags + remainingStyleElements,
  };
};

export { buildAssistModeSnapshot };
