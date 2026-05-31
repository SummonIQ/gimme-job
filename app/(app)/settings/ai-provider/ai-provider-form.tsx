'use client';

import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/css';
import type { AiProvider } from '@/lib/ai/models';

interface AiProviderFormProps {
  readonly current: AiProvider;
  readonly houseEnabled: boolean;
  readonly setProvider: (value: AiProvider) => Promise<void>;
}

interface ProviderOption {
  readonly description: string;
  readonly id: AiProvider;
  readonly title: string;
}

const BASE_OPTIONS: readonly ProviderOption[] = [
  {
    description: 'Routes through OpenAI. Requires OPENAI_API_KEY on the server.',
    id: 'openai',
    title: 'OpenAI',
  },
  {
    description:
      'Runs against an Ollama daemon (local or remote). No data leaves the configured host.',
    id: 'ollama',
    title: 'Local (Ollama)',
  },
];

const HOUSE_OPTION: ProviderOption = {
  description:
    'Operator-managed model. The hosted gimme-job instance routes through this option.',
  id: 'house',
  title: 'gimme-job (managed)',
};

export function AiProviderForm({
  current,
  houseEnabled,
  setProvider,
}: AiProviderFormProps) {
  const [isPending, startTransition] = useTransition();

  const options = houseEnabled
    ? [HOUSE_OPTION, ...BASE_OPTIONS]
    : BASE_OPTIONS;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map(option => {
        const isActive = option.id === current;
        return (
          <button
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
              isActive
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-muted/20 hover:border-border',
              isPending && 'opacity-60',
            )}
            disabled={isPending}
            key={option.id}
            onClick={() => {
              if (option.id === current) return;
              startTransition(async () => {
                await setProvider(option.id);
              });
            }}
            type="button"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {option.title}
              </span>
              {isActive ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Active
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </button>
        );
      })}

      {/* Spacer to keep button consistent on a single-column layout */}
      <div className="hidden md:col-span-2 md:block">
        <Button disabled className="invisible" type="button">
          Saved
        </Button>
      </div>
    </div>
  );
}
