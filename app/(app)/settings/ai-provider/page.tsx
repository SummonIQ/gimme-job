import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import {
  AI_PROVIDER_COOKIE,
  isHouseProviderEnabled,
} from '@/lib/ai/provider';
import type { AiProvider } from '@/lib/ai/models';

import { AiProviderForm } from './ai-provider-form';

export default async function AiProviderSettingsPage() {
  const cookieStore = await cookies();
  const houseEnabled = isHouseProviderEnabled();
  const raw = cookieStore.get(AI_PROVIDER_COOKIE)?.value;
  const current: AiProvider =
    raw === 'openai' || raw === 'ollama'
      ? raw
      : raw === 'house' && houseEnabled
        ? 'house'
        : houseEnabled
          ? 'house'
          : 'openai';

  async function setProvider(value: AiProvider) {
    'use server';

    const houseEnabledNow = isHouseProviderEnabled();
    const next: AiProvider =
      value === 'openai' || value === 'ollama'
        ? value
        : value === 'house' && houseEnabledNow
          ? 'house'
          : 'openai';

    const store = await cookies();
    store.set(AI_PROVIDER_COOKIE, next, {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
    revalidatePath('/settings/ai-provider');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">AI Provider</h2>
        <p className="text-sm text-muted-foreground">
          Choose which AI backend powers resume tailoring, interview prep, job
          analysis, and the rest of the in-app AI features. Your selection is
          stored in a cookie on this device.
        </p>
      </div>

      <AiProviderForm
        current={current}
        houseEnabled={houseEnabled}
        setProvider={setProvider}
      />

      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Local (Ollama) setup</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Install <code>ollama</code> from{' '}
            <a className="underline" href="https://ollama.com" target="_blank" rel="noreferrer">
              ollama.com
            </a>
            .
          </li>
          <li>
            Build the local form-fill model:{' '}
            <code>./scripts/ollama/build-fill-model.sh</code>.
          </li>
          <li>
            Optional long-form model:{' '}
            <code>./scripts/ollama/build-essay-model.sh</code> and set{' '}
            <code>OLLAMA_MODEL_STRONG=gimmejob-essay</code>.
          </li>
          <li>
            Optional vision: <code>ollama pull qwen2.5-vl</code> and set{' '}
            <code>OLLAMA_MODEL_VISION=qwen2.5-vl</code>.
          </li>
          <li>
            The app talks to <code>http://localhost:11434/api</code> by default;
            override with <code>OLLAMA_BASE_URL</code>.
          </li>
        </ol>
      </div>
    </div>
  );
}
