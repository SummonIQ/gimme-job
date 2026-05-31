'use client';

import { RefreshCcwDot } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { revalidateAllCacheData } from '@/lib/cache/revalidate';

export function RevalidateCache() {
  const router = useRouter();

  return (
    <form
      action={async () => {
        revalidateAllCacheData();
        router.refresh();
      }}
    >
      <button
        className="flex flex-row items-center gap-1.5 border-0 bg-transparent text-xs"
        type="submit"
      >
        <RefreshCcwDot className="size-3.5" />
        <span>Revalidate Cache</span>
      </button>
    </form>
  );
}
