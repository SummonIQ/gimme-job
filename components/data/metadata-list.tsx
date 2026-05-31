import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/css';

export type MetadataProps = React.HTMLAttributes<HTMLDivElement>;

const Metadata = ({ children, className, ...props }: MetadataProps) => {
  return (
    <div
      className={cn('flex items-center text-sm text-gray-500', className)}
      {...props}
    >
      {children}
    </div>
  );
};
Metadata.displayName = 'Metadata';

const MetadataIcon = ({
  children,
  ...props
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  if (!isValidElement(children)) {
    console.error(
      'MetadataIcon expects a valid React element as the "icon" prop.',
    );
    return null;
  }

  const originalClassName = (children as ReactElement).props.className;

  return children
    ? cloneElement(children as ReactElement, {
        'aria-hidden': true,
        className: cn(
          'mr-1.5 shrink-0 text-muted-foreground/70',
          props.className,
          originalClassName,
        ),
        ...props,
      })
    : null;
};
MetadataIcon.displayName = 'MetadataIcon';

export type MetadataLabelProps = React.HTMLAttributes<HTMLSpanElement>;
const MetadataLabel = ({
  children,
  className,
  ...props
}: MetadataLabelProps) => {
  return (
    <span
      className={cn(
        'h-5 text-sm font-medium text-muted-foreground/70',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

const MetadataList = ({ children }: { children: ReactNode }) => {
  return (
    <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
      {children}
    </div>
  );
};

export { Metadata, MetadataIcon, MetadataLabel, MetadataList };
