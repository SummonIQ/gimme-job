'use server';

import { revalidatePath, revalidateTag as revalidateTagNext } from 'next/cache';

// Logger disabled due to thread-stream worker issues
// import { logger } from '@/lib/logger';

export async function revalidateAllCacheData() {
  // logger.info(`[CACHE] Revalidating path: /`);
  console.log(`[CACHE] Revalidating path: /`);

  revalidatePath('/');
}

export async function revalidateTag(tag: string) {
  // logger.info(`[CACHE] Revalidating tag: ${tag}`);
  console.log(`[CACHE] Revalidating tag: ${tag}`);

  try {
    await revalidateTagNext(tag, 'max');
  } catch {
    // revalidateTag is unsupported inside after() during render.
    // Silently ignore – clients are notified via Pusher events instead.
  }
}
