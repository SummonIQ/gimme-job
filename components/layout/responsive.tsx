import { cn } from '@/lib/utils';

export interface ResponsiveProps extends React.HTMLAttributes<HTMLDivElement> {
  center?: boolean;
  children?: React.ReactNode;
}

export function Responsive({
  center,
  children,
  className,
  ...props
}: ResponsiveProps) {
  return (
    <div
      {...props}
      className={cn(
        'mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-8xl flex-1 flex-col px-3 lg:px-0 pt-0 md:pt-0',
        center && 'mx-auto',
        className
      )}
    >
      {children}
    </div>
  );
}
