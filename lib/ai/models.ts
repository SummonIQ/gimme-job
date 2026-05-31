import { createOpenAI } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ollama default base URL is the daemon running on the user's machine.
// Override with OLLAMA_BASE_URL when proxying through a remote host (e.g.
// a tunnel to a home GPU box). When OLLAMA_AUTH_TOKEN is set we attach it
// as a Bearer header so the remote relay can authenticate this client.
const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
  headers: process.env.OLLAMA_AUTH_TOKEN
    ? { Authorization: `Bearer ${process.env.OLLAMA_AUTH_TOKEN}` }
    : undefined,
});

const OLLAMA_MODEL_FAST =
  process.env.OLLAMA_MODEL_FAST ??
  process.env.OLLAMA_MODEL_PRIMARY ??
  'gimmejob-fill';
const OLLAMA_MODEL_PRIMARY =
  process.env.OLLAMA_MODEL_PRIMARY ?? OLLAMA_MODEL_FAST;
const OLLAMA_MODEL_STRONG =
  process.env.OLLAMA_MODEL_STRONG ?? OLLAMA_MODEL_PRIMARY;

/**
 * Central model configuration.
 * Change these to swap providers or models across the entire app.
 *
 * To switch to Gemini, replace openai() calls with google() calls:
 *   import { createGoogleGenerativeAI } from '@ai-sdk/google';
 *   const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
 *   fast: google('gemini-2.5-flash'),
 */
export const models = {
  /** Fast, cheap model for simple tasks */
  fast: openai('gpt-4o-mini'),

  /** Primary model for most AI tasks */
  primary: openai('gpt-4o-mini'),

  /** Strongest model for complex reasoning */
  strong: openai('gpt-4o'),
} as const;

/**
 * Provider identifier used across all AI helpers.
 *
 * - `openai`: direct OpenAI usage. Default for the open-source build.
 * - `ollama`: routes through a local (or remote) Ollama daemon. The user opts
 *   in per-device.
 * - `house`: opaque "operator provided" provider. The hosted gimme-job
 *   instance ships with `GIMMEJOB_HOUSE_PROVIDER=true` so the cookie can
 *   resolve to `house`; operators are free to swap the underlying client
 *   in `getModels` without changing user-facing UI. In the open-source
 *   build the env flag is unset and `house` is never selectable.
 */
export type AiProvider = 'openai' | 'ollama' | 'house';

export interface AiModelTrio {
  readonly fast: LanguageModel;
  readonly primary: LanguageModel;
  readonly strong: LanguageModel;
}

/**
 * Resolve a model trio for a given provider. Lets a single API route flip
 * between OpenAI and a locally-hosted Ollama daemon at request time without
 * touching the rest of the call site.
 *
 * Ollama models are configured via env (OLLAMA_BASE_URL, OLLAMA_MODEL_*) so
 * the user can point at any ollama-compatible server and any installed model
 * without code changes. Defaults assume `scripts/ollama/build-fill-model.sh`
 * has created `gimmejob-fill` for fast local field-answer work.
 */
export function getModels(provider: AiProvider = 'openai'): AiModelTrio {
  if (provider === 'ollama') {
    return {
      fast: ollama(OLLAMA_MODEL_FAST),
      primary: ollama(OLLAMA_MODEL_PRIMARY),
      strong: ollama(OLLAMA_MODEL_STRONG),
    };
  }
  // 'house' currently aliases the OpenAI trio. Operators that ship the hosted
  // build can swap to a custom client (fine-tuned model, internal proxy, etc.)
  // without changing call sites, since callers only see the abstract trio.
  return models;
}
