import { cn } from '@/lib/css';

interface FieldsProps extends React.HTMLAttributes<HTMLDListElement> {
  children: React.ReactNode;
  columns?: number;
}
const Fields = ({ children, className, ...props }: FieldsProps) => {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-[1px] overflow-hidden bg-muted/90',
        className,
      )}
      {...props}
    >
      {children}
    </dl>
  );
};

interface FieldProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}
const Field = ({ children, className, ...props }: FieldProps) => {
  return (
    <div
      className={cn('col-span-1 gap-1 bg-background p-4 md:p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
};

interface FieldLabelProps extends FieldProps {
  children: React.ReactNode;
}
const FieldLabel = ({ children, className, ...props }: FieldLabelProps) => {
  return (
    <dt
      className={cn(
        'text-sm/6 font-medium tracking-wide text-muted-foreground/80',
        className,
      )}
      {...props}
    >
      {children}
    </dt>
  );
};

interface FieldValueProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}
const FieldValue = ({ children, className, ...props }: FieldValueProps) => {
  return (
    <dd className={cn('text-sm/6 text-foreground', className)} {...props}>
      <span>{children}</span>
    </dd>
  );
};

export { Field, FieldLabel, Fields, FieldValue };
