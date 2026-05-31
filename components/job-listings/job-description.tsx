import { AlertTriangle, Info } from 'lucide-react';
import { Fragment } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

interface JobDescriptionProps {
  description: string;
  className?: string;
}

// URL regex pattern - matches http://, https://, and www. URLs
// NOTE: Do NOT use the global flag (g) on a shared regex — it makes .test()
// stateful (lastIndex advances), causing inconsistent results across React renders.
const URL_PATTERN = /(https?:\/\/[^\s<>)"']+|www\.[^\s<>)"']+)/i;

// Helper to format text with clickable URLs
function formatTextWithLinks(text: string): React.ReactNode {
  const parts = text.split(URL_PATTERN);
  if (parts.length === 1) return text;

  return parts.map((part, idx) => {
    if (URL_PATTERN.test(part)) {
      // Reset lastIndex since we're reusing the regex

      const trailingPunctuationMatch = part.match(/^(.*?)([.,!?;:]+)$/);
      const rawUrl = trailingPunctuationMatch
        ? trailingPunctuationMatch[1]
        : part;
      const trailingPunctuation = trailingPunctuationMatch
        ? trailingPunctuationMatch[2]
        : '';
      // Add https:// prefix for www. URLs
      const href = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
      return (
        <Fragment key={idx}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {rawUrl}
          </a>
          {trailingPunctuation}
        </Fragment>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

function normalizeSentenceSpacing(text: string): string {
  const parts = text.split(URL_PATTERN);
  if (parts.length === 1) {
    return text.replace(/\.([A-Za-z])/g, '. $1');
  }

  return parts
    .map(part => {
      if (URL_PATTERN.test(part)) {
        return part;
      }

      return part.replace(/\.([A-Za-z])/g, '. $1');
    })
    .join('');
}

/**
 * Parses and renders a job description with proper formatting:
 * - Headings (lines ending with ":" or common heading patterns)
 * - Bullet lists (lines starting with bullet characters)
 * - Numbered lists (lines starting with numbers)
 * - Key-value pairs (lines like "Company: Name")
 * - Regular paragraphs
 */
export function JobDescription({
  description,
  className,
}: JobDescriptionProps) {
  // Guard against catastrophic regex backtracking on very long descriptions
  if (description.length > 15000) {
    return (
      <div className={className}>
        <p className="whitespace-pre-wrap">{description}</p>
      </div>
    );
  }

  try {
    const elements = parseJobDescription(description);
    return <div className={className}>{elements}</div>;
  } catch {
    // Fallback: render as plain text if parsing fails
    return (
      <div className={className}>
        <p className="whitespace-pre-wrap">{description}</p>
      </div>
    );
  }
}

// Alert pattern for inline detection
const ALERT_KEYWORDS =
  /\b(IMPORTANT\s*NOTES?|WARNINGS?|CAUTIONS?|NOTES?|NOTICES?|ATTENTION|CRITICAL|ALERTS?):\s*/i;
const INLINE_SECTION_HEADING_PATTERN = /^(Responsibilities):\s*(.+)$/i;

function parseJobDescription(description: string): React.ReactNode[] {
  // Remove leading "Description" since it's usually already shown as a heading
  const cleanedDescription = description
    .replace(/^Description\s*\n?/i, '')
    .trim();

  // Pre-process: split lines that contain inline alert patterns or all-caps warnings
  const normalizedDescription = normalizeSentenceSpacing(cleanedDescription);
  const rawLines = normalizedDescription.split(/\n/).map(l => l.trim());
  const lines: string[] = [];
  for (const line of rawLines) {
    if (/[•·▪]/.test(line) && !/^[•·▪]/.test(line)) {
      const inlineParts = line.split(/[•·▪]\s*/).map(part => part.trim());
      const [leadingText, ...bulletParts] = inlineParts;
      if (leadingText) {
        lines.push(leadingText);
      }
      bulletParts.filter(Boolean).forEach(part => {
        lines.push(`• ${part}`);
      });
      continue;
    }
    // Check if line contains an inline alert pattern (not at start)
    const inlineMatch = line.match(
      /(.+?)\s+(IMPORTANT\s*NOTES?|WARNINGS?|CAUTIONS?|CRITICAL|ALERTS?):\s*(.*)$/i,
    );
    if (inlineMatch && inlineMatch[1].length > 10) {
      // Split into two lines: text before alert, and alert with content
      lines.push(inlineMatch[1].trim());
      lines.push(`${inlineMatch[2]}: ${inlineMatch[3]}`.trim());
    }
    // Check for inline all-caps warning text (at least 50 chars of consecutive caps)
    else {
      // Only check short-to-medium lines for all-caps segments to avoid backtracking
      const allCapsMatch =
        line.length < 500
          ? line.match(/^(.{6,}?[.!?]\s+)([A-Z][A-Z ,./\-()&]{50,}[.!?])(.*)$/)
          : null;
      if (allCapsMatch && allCapsMatch[1].length > 5) {
        // Split: text before, all-caps as warning, text after
        if (allCapsMatch[1].trim()) {
          lines.push(allCapsMatch[1].trim());
        }
        lines.push(`NOTICE: ${allCapsMatch[2].trim()}`);
        if (allCapsMatch[3].trim()) {
          lines.push(allCapsMatch[3].trim());
        }
      } else {
        lines.push(line);
      }
    }
  }

  const isHeading = (
    line: string,
    prevLine: string,
    nextLine: string,
  ): boolean => {
    // Ends with colon only (e.g., "Requirements:", "About Us:")
    if (/^[A-Z][^.!?]*:$/.test(line) && line.length < 60) return true;
    // All caps short line
    if (
      line === line.toUpperCase() &&
      line.length > 3 &&
      line.length < 50 &&
      /^[A-Z\s&]+$/.test(line)
    )
      return true;
    // Common heading patterns without periods
    if (
      /^(About|What|Why|Our|The|Key|Your|Job|Position|Role|Company|Team|Benefits|Requirements|Qualifications|Responsibilities|Overview|Summary|Duties|Skills|Experience|Education|Compensation|Perks|Major|Essential|Preferred|Minimum|Additional|Primary|Core|Main)\b/i.test(
        line,
      ) &&
      line.length < 60 &&
      !line.includes('.')
    )
      return true;
    // Short title-case phrases (2-4 words) with empty lines around them
    const words = line.split(/\s+/);
    if (
      words.length >= 1 &&
      words.length <= 4 &&
      line.length < 40 &&
      !line.includes('.') &&
      !line.includes(':') &&
      /^[A-Z]/.test(line) &&
      !prevLine &&
      !nextLine
    )
      return true;
    return false;
  };

  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // Check for alert/callout patterns (IMPORTANT:, WARNING:, NOTE:, IMPORTANT NOTES:, etc.)
    const alertMatch = line.match(
      /^(IMPORTANT\s*NOTES?|IMPORTANT|WARNINGS?|CAUTIONS?|NOTES?|NOTICES?|ATTENTION|CRITICAL|ALERTS?):\s*(.*)$/i,
    );
    if (alertMatch) {
      const alertType = alertMatch[1].toUpperCase();
      let content = alertMatch[2];
      i++;

      // Collect following lines that are part of this alert (until empty line or new section pattern)
      while (i < lines.length) {
        const l = lines[i];
        if (!l) {
          i++;
          break;
        }
        // Stop if we hit a heading-like pattern (but NOT numbered list items which may be part of the alert)
        if (/^[A-Za-z][A-Za-z\s]+:$/.test(l)) {
          break;
        }
        content += ' ' + l;
        i++;
      }

      // Parse numbered items from content (e.g., "1) text 2) text 3) text")
      const numberedItemsMatch = content.match(/\d+\)\s+/g);
      let alertContent: React.ReactNode;

      if (numberedItemsMatch && numberedItemsMatch.length >= 2) {
        // Split by numbered pattern and create list
        const items = content.split(/\d+\)\s+/).filter(item => item.trim());
        alertContent = (
          <ol className="list-decimal list-inside space-y-1 mt-1">
            {items.map((item, idx) => (
              <li key={idx}>{formatTextWithLinks(item.trim())}</li>
            ))}
          </ol>
        );
      } else {
        alertContent = formatTextWithLinks(content.trim());
      }

      const isWarning = /^(IMPORTANT|WARNING|CAUTION|CRITICAL|ALERT)/i.test(
        alertType,
      );
      elements.push(
        <Alert key={elements.length} variant={isWarning ? 'warning' : 'info'}>
          {isWarning ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Info className="h-5 w-5" />
          )}
          <AlertTitle className="text-base font-semibold">
            {alertType}
          </AlertTitle>
          <AlertDescription>{alertContent}</AlertDescription>
        </Alert>,
      );
      continue;
    }

    const inlineSectionHeadingMatch = line.match(
      INLINE_SECTION_HEADING_PATTERN,
    );
    if (inlineSectionHeadingMatch) {
      elements.push(
        <h4
          key={elements.length}
          className="font-semibold text-foreground text-[15px] mt-6 mb-1.5 first:mt-0"
        >
          {inlineSectionHeadingMatch[1]}
        </h4>,
      );
      elements.push(
        <p key={elements.length} className="leading-relaxed mb-3 last:mb-0">
          {formatTextWithLinks(inlineSectionHeadingMatch[2].trim())}
        </p>,
      );
      i++;
      continue;
    }

    // Check for key-value metadata pairs (e.g., "Company: Providence Jobs")
    // Must check BEFORE headings since headings end with ":" but have no value
    const kvMatch = line.match(/^([A-Za-z][A-Za-z0-9\s\/\-]+):\s*(.+)$/);
    if (kvMatch && kvMatch[1].length < 35) {
      const kvItems: { key: string; value: string }[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(/^([A-Za-z][A-Za-z0-9\s\/\-]+):\s*(.+)$/);
        if (m && m[1].length < 35) {
          kvItems.push({ key: m[1], value: m[2] });
          i++;
        } else if (!l) {
          i++;
          break;
        } else {
          break;
        }
      }
      if (kvItems.length > 0) {
        elements.push(
          <Table key={elements.length}>
            <TableBody>
              {kvItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-1.5 pr-4 font-medium text-foreground whitespace-nowrap w-px">
                    {item.key}:
                  </TableCell>
                  <TableCell className="py-1.5">
                    {formatTextWithLinks(item.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>,
        );
      }
      continue;
    }

    // Check for heading (after KV check - headings end with ":" but have no value)
    const prevLine = i > 0 ? lines[i - 1] : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
    if (isHeading(line, prevLine, nextLine)) {
      elements.push(
        <h4
          key={elements.length}
          className="font-semibold text-foreground text-[15px] mt-6 mb-1.5 first:mt-0"
        >
          {line.replace(/:$/, '')}
        </h4>,
      );
      i++;
      continue;
    }

    const boldHeadingMatch = line.match(/^\*{1,2}\s*(.+?)\s*\*{1,2}$/);
    if (boldHeadingMatch) {
      elements.push(
        <h4
          key={elements.length}
          className="font-semibold text-foreground text-[15px] mt-6 mb-1.5 first:mt-0"
        >
          {boldHeadingMatch[1]}
        </h4>,
      );
      i++;
      continue;
    }

    // Check for bullet list item
    const bulletMatch = line.match(/^[•\-\*·▪]\s*(.+)/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(/^[•\-\*·▪]\s*(.+)/);
        if (m) {
          items.push(m[1]);
          i++;
        } else if (!l) {
          i++;
          break;
        } else {
          break;
        }
      }
      elements.push(
        <ul key={elements.length} className="my-2.5 space-y-2 list-none pl-4">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-primary shrink-0">•</span>
              <span>{formatTextWithLinks(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Check for numbered list item
    const numberedMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
    if (numberedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(/^\d+[\.\)]\s*(.+)/);
        if (m) {
          items.push(m[1]);
          i++;
        } else if (!l) {
          i++;
          break;
        } else {
          break;
        }
      }
      elements.push(
        <ol
          key={elements.length}
          className="space-y-1.5 list-decimal list-inside"
        >
          {items.map((item, idx) => (
            <li key={idx}>{formatTextWithLinks(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Regular paragraph - collect consecutive non-list, non-heading lines
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l) {
        i++;
        break;
      }
      if (/^[•\-\*·▪]\s/.test(l) || /^\d+[\.\)]\s/.test(l)) {
        break;
      }
      // Also break if we hit an alert pattern
      if (ALERT_KEYWORDS.test(l)) {
        break;
      }
      // Also break if next line looks like a heading or KV pair
      const pPrev = i > 0 ? lines[i - 1] : '';
      const pNext = i < lines.length - 1 ? lines[i + 1] : '';
      const kvBreakMatch = l.match(/^([A-Za-z][A-Za-z0-9\s\/\-]+):\s*.+$/);
      if (
        isHeading(l, pPrev, pNext) ||
        (kvBreakMatch && kvBreakMatch[1].length < 35)
      ) {
        break;
      }
      paragraphLines.push(l);
      i++;
    }
    if (paragraphLines.length > 0) {
      elements.push(
        <p key={elements.length} className="leading-relaxed mb-3 last:mb-0">
          {formatTextWithLinks(paragraphLines.join(' '))}
        </p>,
      );
    }
  }

  return elements;
}
