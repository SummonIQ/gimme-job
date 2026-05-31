'use client';

import { formatRelativeTime } from '@/lib/time';

export interface DateLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  date: Date;
  variant?: 'long' | 'short' | 'relative';
}

const DateLabel = ({ date, variant = 'short', ...props }: DateLabelProps) => {
  const dateObject = new Date(date);

  if (variant === 'relative') {
    return <span {...props}>{formatRelativeTime(dateObject)}</span>;
  }

  return (
    <span {...props}>
      {Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dateObject)}
    </span>
  );
};

export { DateLabel };
