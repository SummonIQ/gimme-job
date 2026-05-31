import { Fragment } from 'react';

interface SafeJobDescriptionProps {
  description: string;
  className?: string;
}

const URL_RE = /(https?:\/\/[^\s<>)"']+)/;

function linkify(text: string): React.ReactNode {
  const parts = text.split(URL_RE);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      const clean = part.replace(/[.,;:!?)]+$/, '');
      const trailing = part.slice(clean.length);
      return (
        <Fragment key={i}>
          <a
            href={clean}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {clean}
          </a>
          {trailing}
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function SafeJobDescription({ description, className }: SafeJobDescriptionProps) {
  const paragraphs = description.split(/\n{2,}/);

  return (
    <div className={className}>
      {paragraphs.map((para, i) => {
        const lines = para.split('\n');
        return (
          <p key={i} className="whitespace-pre-wrap">
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && '\n'}
                {linkify(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
