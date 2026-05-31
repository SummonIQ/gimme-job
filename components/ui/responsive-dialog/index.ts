'use client';

import dynamic from 'next/dynamic';

export const ResponsiveDialog = dynamic(
  () => import('./responsive-dialog').then(mod => mod.ResponsiveDialog),
  { ssr: false },
);

export const ResponsiveDialogContainer = dynamic(
  () =>
    import('./responsive-dialog').then(mod => mod.ResponsiveDialogContainer),
  { ssr: false },
);

export const ResponsiveDialogContent = dynamic(
  () => import('./responsive-dialog').then(mod => mod.ResponsiveDialogContent),
  { ssr: false },
);

export const ResponsiveDialogDescription = dynamic(
  () =>
    import('./responsive-dialog').then(mod => mod.ResponsiveDialogDescription),
  { ssr: false },
);

export const ResponsiveDialogFooter = dynamic(
  () => import('./responsive-dialog').then(mod => mod.ResponsiveDialogFooter),
  { ssr: false },
);

export const ResponsiveDialogHeader = dynamic(
  () => import('./responsive-dialog').then(mod => mod.ResponsiveDialogHeader),
  { ssr: false },
);

export const ResponsiveDialogTitle = dynamic(
  () => import('./responsive-dialog').then(mod => mod.ResponsiveDialogTitle),
  { ssr: false },
);

export const ResponsiveDialogTrigger = dynamic(
  () => import('./responsive-dialog').then(mod => mod.ResponsiveDialogTrigger),
  { ssr: false },
);
