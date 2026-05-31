/**
 * Pre-warm the field-answer resolver's in-process cache for the current
 * user. Called by the assist-mode modal's open handler so the first real
 * field-answer call lands on a warm cache (avoiding 4-6 sequential DB
 * round-trips on the slow path). Returns 200 immediately even if the
 * loaders are still in-flight — they finish in the background and land
 * in the resolver cache for the next call.
 */
import { NextResponse } from 'next/server';

import { prewarmResolverCache } from '@/lib/field-answer/resolve';
import { getCurrentUser } from '@/lib/user/query';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { jobLeadId?: string; applicationUrl?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Empty / non-JSON body is fine — no per-job context to prewarm.
  }

  let hostname: string | null = null;
  if (body.applicationUrl) {
    try {
      hostname = new URL(body.applicationUrl).hostname.toLowerCase();
    } catch {
      hostname = null;
    }
  }

  // Fire-and-forget. Returning before the loaders finish is the whole point;
  // the next resolveFieldAnswer call will pick up whatever finished and wait
  // on whatever's still in-flight (the cache stores the promise).
  void prewarmResolverCache(user.id, {
    jobLeadId: body.jobLeadId ?? null,
    hostname,
  });

  return NextResponse.json({ ok: true });
}
