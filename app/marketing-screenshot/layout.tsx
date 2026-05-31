import type React from 'react';

export default function MarketingScreenshotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-screen grow flex-col bg-white dark:bg-slate-950">
      {children}
    </div>
  );
}
