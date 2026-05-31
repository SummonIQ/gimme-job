'use client';

import { Code, FileText, Globe, Loader2, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface EmbeddedPageViewerProps {
  className?: string;
  url: string;
  /** Called when the page HTML is loaded, before rendering. Use this to
   *  drive client-side training by sending the HTML to the analyze endpoint. */
  onHtmlLoaded?: (html: string, url: string) => void;
}

function useIsDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * Renders a remote page's HTML+CSS in an isolated Shadow DOM container.
 * Uses the /api/assist-mode proxy to fetch and sanitize the page content.
 * Supports "Adapted" (with styles) and "Raw" (stripped) view modes.
 */
export function EmbeddedPageViewer({ className, url, onHtmlLoaded }: EmbeddedPageViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentView, setContentView] = useState<'adapted' | 'raw'>('adapted');
  const [noJs, setNoJs] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isDark = useIsDarkMode();
  const htmlRef = useRef('');
  const stylesRef = useRef('');

  const baseStyles = () => {
    const isDark = document.documentElement.classList.contains('dark');
    return `
      :host {
        display: block;
        height: 100%;
        width: 100%;
        overflow: auto;
        color-scheme: ${isDark ? 'dark' : 'light'};
        background: ${isDark ? '#0f0e1a' : '#f8fafc'};
        color: ${isDark ? '#e2e8f0' : '#0f172a'};
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont;
      }
      * { box-sizing: border-box; }
      .viewer-root {
        position: relative;
        min-height: 100%;
        width: 100%;
        max-width: 100%;
      }
      .viewer-root, .viewer-root * {
        max-inline-size: 100%;
      }
      .viewer-root * {
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        zoom: 1 !important;
      }
      .viewer-root [style*="position:fixed"],
      .viewer-root [style*="position: fixed"],
      .viewer-root [style*="position:sticky"],
      .viewer-root [style*="position: sticky"] {
        position: static !important;
      }
      .viewer-root [style*="100vw"],
      .viewer-root [style*="100vh"] {
        width: 100% !important;
        height: auto !important;
      }
      .viewer-root [style*="z-index"] {
        z-index: auto !important;
      }
    `;
  };

  const renderContent = () => {
    if (!shadowRef.current) return;
    const base = baseStyles();
    const html = htmlRef.current;
    const styles = stylesRef.current;

    if (contentView === 'raw') {
      let rawHtml = html;
      rawHtml = rawHtml.replace(/\sstyle="[^"]*"/gi, '');
      rawHtml = rawHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      shadowRef.current.innerHTML = `<style>${base}</style><div class="viewer-root">${rawHtml}</div>`;
    } else {
      shadowRef.current.innerHTML = `<style>${base}</style>${styles}<div class="viewer-root">${html}</div>`;
    }
  };

  useEffect(() => {
    if (!url || !containerRef.current) return;

    const controller = new AbortController();

    const fetchPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          url,
          render: '1',
          ...(noJs ? { nojs: '1' } : {}),
          ...(isDark ? { dark: '1' } : {}),
          ...(mobile ? { mobile: '1' } : {}),
        });
        const response = await fetch(
          `/api/assist-mode?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data?.botProtection) {
            setError('This site has bot protection and cannot be previewed.');
            return;
          }
          throw new Error(data?.error || `Failed to load page (${response.status})`);
        }

        const data = (await response.json()) as {
          html?: string;
          styles?: string;
        };

        if (!containerRef.current) return;

        if (!shadowRef.current) {
          shadowRef.current = containerRef.current.attachShadow({ mode: 'open' });
        }

        htmlRef.current = data.html ?? '';
        stylesRef.current = data.styles ?? '';
        renderContent();

        // Notify parent that HTML is available for training analysis
        if (onHtmlLoaded && htmlRef.current) {
          onHtmlLoaded(htmlRef.current, url);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPage();

    return () => controller.abort();
  }, [url, noJs, isDark, mobile, refreshKey]);

  // Re-render when view mode changes
  useEffect(() => {
    if (htmlRef.current) {
      renderContent();
    }
  }, [contentView]);

  return (
    <div className={`relative flex flex-col rounded-lg border border-border/60 overflow-hidden ${className ?? ''}`}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-1.5">
        {/* Refresh */}
        <button
          type="button"
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={isLoading}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* URL */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border/40 bg-background/50 px-2 py-0.5">
          <Globe className="size-3 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {url}
          </span>
        </div>

        {/* JavaScript toggle */}
        <button
          type="button"
          onClick={() => setNoJs(v => !v)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={noJs ? 'JavaScript disabled' : 'JavaScript enabled'}
        >
          <span className={`inline-block size-1.5 rounded-full ${noJs ? 'bg-red-500' : 'bg-green-500'}`} />
          <span>JS</span>
        </button>

        {/* Desktop / Mobile toggle */}
        <div className="inline-flex h-6 items-center rounded-md bg-muted/50 p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setMobile(false)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors ${
              !mobile ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Monitor className="size-3" />
            {!mobile && 'Desktop'}
          </button>
          <button
            type="button"
            onClick={() => setMobile(true)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors ${
              mobile ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="size-3" />
            {mobile && 'Mobile'}
          </button>
        </div>

        {/* Adapted / Raw toggle */}
        <div className="inline-flex h-6 items-center rounded-md bg-muted/50 p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setContentView('adapted')}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors ${
              contentView === 'adapted' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="size-3" />
            {contentView === 'adapted' && 'Adapted'}
          </button>
          <button
            type="button"
            onClick={() => setContentView('raw')}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors ${
              contentView === 'raw' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="size-3" />
            {contentView === 'raw' && 'Raw'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`relative min-h-0 flex-1 ${mobile ? 'flex justify-center bg-zinc-950/50' : ''}`}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            {error}
          </div>
        ) : (
          <div
            ref={containerRef}
            className={mobile ? 'h-full w-[390px] border-x border-border/30' : 'h-full w-full'}
          />
        )}
      </div>
    </div>
  );
}
