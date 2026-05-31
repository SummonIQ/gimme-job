'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

/**
 * Wraps the intercepted session detail route in a bottom slide-up sheet.
 * Closing the sheet navigates back — dropping the intercept and returning
 * the user to the training list. Direct URL navigation / page refresh
 * bypasses this shell entirely and renders the full [id]/page.tsx.
 */
export function SessionModalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Trigger the slide-up animation on mount instead of snapping to open.
  useEffect(() => {
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        // Give the exit animation a frame before tearing down the route.
        window.setTimeout(() => router.back(), 160);
      }
    },
    [router],
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] overflow-hidden rounded-t-2xl border-t p-0"
      >
        <SheetTitle className="sr-only">Training session detail</SheetTitle>
        <div className="flex h-full w-full flex-col overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
