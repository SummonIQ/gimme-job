import { MarkdownPreview } from '@/components/data/markdown-preview';
import { Card, CardContent } from '@/components/ui/card';
import { ReadMoreBlock } from '@/components/ui/read-more-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeResumeMarkdown } from '@/lib/resumes/normalize-markdown';

interface OriginalResumeSectionProps {
  description: string | null;
  markdown: string | null;
  url: string | null;
}

export function OriginalResumeSection({
  description,
  markdown,
  url,
}: OriginalResumeSectionProps) {
  const normalizedMarkdown = markdown
    ? normalizeResumeMarkdown(markdown)
    : null;
  const pdfUrl = isPdfUrl(url) ? url : null;
  const wordUrl = isWordUrl(url) ? getDocumentPreviewUrl(url) : null;
  const defaultTab = pdfUrl ? 'pdf' : wordUrl ? 'word' : 'markdown';

  return (
    <Card>
      <CardContent className="p-3 md:p-3">
        {description?.trim() ? (
          <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}

        {url || normalizedMarkdown ? (
          <Tabs className="preview space-y-3" defaultValue={defaultTab}>
            <TabsList className="flex">
              <TabsTrigger value="pdf">PDF</TabsTrigger>
              <TabsTrigger value="word">Word</TabsTrigger>
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
            </TabsList>
            <TabsContent scrollable={false} value="pdf">
              {pdfUrl ? (
                <iframe
                  className="h-[72vh] w-full rounded-lg border border-border bg-muted/20"
                  src={pdfUrl}
                  title="Original resume PDF"
                />
              ) : (
                <UnavailableFormat format="PDF" />
              )}
            </TabsContent>
            <TabsContent scrollable={false} value="word">
              {wordUrl ? (
                <iframe
                  className="h-[72vh] w-full rounded-lg border border-border bg-muted/20"
                  src={wordUrl}
                  title="Original resume Word document"
                />
              ) : (
                <UnavailableFormat format="Word" />
              )}
            </TabsContent>
            <TabsContent className="p-0" scrollable={false} value="markdown">
              {normalizedMarkdown ? (
                <ReadMoreBlock className="rounded-lg border border-border bg-muted/20 p-3 drop-shadow-lg dark:bg-white/[0.04]">
                  <MarkdownPreview
                    className="inset-shadow"
                    markdown={normalizedMarkdown}
                    paged
                  />
                </ReadMoreBlock>
              ) : (
                <UnavailableFormat format="Markdown" />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              No preview available yet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UnavailableFormat({ format }: { format: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        No {format} preview available.
      </p>
    </div>
  );
}

function isPdfUrl(url: string | null): boolean {
  if (!url) return false;

  return !isWordUrl(url);
}

function isWordUrl(url: string | null): boolean {
  if (!url) return false;

  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.doc') || path.endsWith('.docx');
}

function getDocumentPreviewUrl(url: string | null): string | null {
  if (!url) return null;

  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.pdf')) {
    return url;
  }

  if (path.endsWith('.doc') || path.endsWith('.docx')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }

  return url;
}
