'use server';

import { unstable_cacheLife } from 'next/cache';

export async function cacheLife(
  life: 'seconds' | 'minutes' | 'hours' | 'days',
) {
  return unstable_cacheLife(life);
}
