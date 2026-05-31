import * as React from 'react';

import { cn } from '@/lib/css/index';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground flex min-h-[80px] w-full min-w-0 rounded-lg border border-border/50 bg-input px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-transparent focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
