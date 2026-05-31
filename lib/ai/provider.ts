import { cookies } from 'next/headers';

import type { AiProvider } from './models';

export const AI_PROVIDER_COOKIE = 'gimmejob.ai-provider';

/**
 * Resolve the active AI provider for the current request.
 *
 * Order of resolution:
 * 1. The user's cookie selection — `openai`, `ollama`, or `house` (only if
 *    the operator opted in via `GIMMEJOB_HOUSE_PROVIDER=true`).
 * 2. The operator default — `house` when the env flag is set, otherwise
 *    `openai`.
 *
 * Always defaults to `openai` outside of a request scope (background jobs,
 * crons, scripts) so unknown call sites never accidentally hit a local
 * Ollama daemon that may not be running.
 */
export async function getServerAiProvider(): Promise<AiProvider> {
  const houseEnabled = process.env.GIMMEJOB_HOUSE_PROVIDER === 'true';
  const fallback: AiProvider = houseEnabled ? 'house' : 'openai';

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(AI_PROVIDER_COOKIE)?.value;
    if (raw === 'openai' || raw === 'ollama') return raw;
    if (raw === 'house' && houseEnabled) return 'house';
  } catch {
    // cookies() unavailable in this context (background job, RSC at build,
    // etc.) — fall through to the operator default.
  }

  return fallback;
}

export function isHouseProviderEnabled(): boolean {
  return process.env.GIMMEJOB_HOUSE_PROVIDER === 'true';
}
