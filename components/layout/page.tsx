'use client';

import { cn } from '@/lib/css';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Responsive } from './responsive';

import { type ReactNode } from 'react';
import { PageTracker } from '../analytics/page-tracker';
import { Metadata } from '../data/metadata-list';

interface PageProps extends React.HTMLAttributes<HTMLDivElement> {
  card?: boolean;
  actions?: ReactNode;
  centered?: boolean;
  fullWidth?: boolean;
  contentWrapper?: boolean;
  description?: string;
  name: string;
  properties?: Record<string, any>;
  title?: string;
}

export function Page({
  actions,
  className,
  card,
  description,
  name,
  properties,
  centered = true,
  contentWrapper = true,
  children,
  fullWidth = false,
  title,
  ...props
}: PageProps) {
  if (fullWidth) {
    return (
      <div className={cn('flex grow flex-col', className)} {...props}>
        {title || description || actions ? (
          <PageHeader
            title={title}
            description={description}
            actions={actions}
          />
        ) : null}
        {children}
        <PageTracker pageName={name} properties={properties} />
      </div>
    );
  }

  return (
    <>
      <Responsive
        center={centered}
        className={cn('flex grow flex-col', className)}
      >
        {title || description || actions ? (
          <PageHeader
            title={title}
            description={description}
            actions={actions}
          />
        ) : null}

        {contentWrapper ? <PageContent card={card}>{children}</PageContent> : children}
      </Responsive>
      <PageTracker pageName={name} properties={properties} />
    </>
  );
}

interface PageHeaderProps extends Omit<HTMLMotionProps<'div'>, 'title'> {
  actions?: ReactNode;
  title?: ReactNode;
  description?: string;
}

export function PageHeader({
  actions,
  className,
  children,
  title,
  description,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.25,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn('shrink-0 pt-6 pb-9 flex px-1 flex-col md:flex-row justify-between items-center', className)}
      role="region"
      aria-label="Page header"
    >
        <div className="flex gap-y-1 flex-col min-w-0">
          {title && <PageTitle>{title}</PageTitle>}
          {description && <PageDescription>{description}</PageDescription>}
        </div>

        {actions && (
          <PageActions
            className="shrink-0 will-change-transform **:data-[slot=button]:h-9 **:data-[slot=button]:px-4 **:data-[slot=button]:text-sm"
            data-animated
          >
            {actions}
          </PageActions>
        )}
    </motion.div>
  );
}

interface PageSummaryProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PageSummary({ className, ...props }: PageSummaryProps) {
  return <div className={cn('flex grow flex-col', className)} {...props} />;
}

interface PageTitleProps extends HTMLMotionProps<'h1'> {}

export function PageTitle({ className, children }: PageTitleProps) {
  return (
    <motion.h1
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 2 }}
      transition={{
        delay: 0.05,
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        'text-2xl flex flex-row gap-x-6 leading-6 items-center justify-start',
        'font-bold text-foreground',
        'will-change-transform',
        className,
      )}
    >
      {children}
    </motion.h1>
  );
}

interface PageDescriptionProps extends HTMLMotionProps<'div'> {}

export function PageDescription({ className, children }: PageDescriptionProps) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.12,
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        'mt-0.5 text-sm text-muted-foreground leading-tight',
        className,
      )}
    >
      {children}
    </motion.p>
  );
}

interface PageMetadataProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PageMetadata({ className, ...props }: PageMetadataProps) {
  return <Metadata className={cn('', className)} {...props} />;
}

interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  card?: boolean;
}

export function PageContent({
  card = false,
  className,
  children,
}: PageContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.2,
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        'flex flex-1 flex-col gap-y-4',
        card &&
          'rounded-3xl overflow-hidden border-y border-border bg-background/85 shadow-[0_22px_70px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/5 dark:bg-zinc-900/85 dark:shadow-[0_32px_95px_-46px_rgba(0,0,0,0.75)]',
        className,
      )}
      role="region"
      aria-label="Page content"
    >
      {children}
    </motion.div>
  );
}

interface PageActionsProps extends HTMLMotionProps<'div'> {}

export function PageActions({ className, children }: PageActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.18,
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn('flex items-center gap-3', className)}
    >
      {children}
    </motion.div>
  );
}

interface PageBackButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  href?: string;
}

export function PageBackButton({
  className,
  href,
  ...props
}: PageBackButtonProps) {
  return (
    <button
      className={cn(
        'text-sm text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
