'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TrustLevel, TrustScope } from '@/lib/runtime-trust-ladder';

import { demoteTrustScope } from '../actions';

const LEVELS: readonly TrustLevel[] = [
  'OBSERVE_ONLY',
  'SUGGEST_ONLY',
  'ACTION_WITH_CONFIRMATION',
  'AUTO_STEP_GUARDED',
];

export function DemoteDialog({
  scope,
  currentLevel,
}: {
  scope: TrustScope;
  currentLevel: TrustLevel;
}) {
  const [open, setOpen] = useState(false);
  const [demotedTo, setDemotedTo] = useState<TrustLevel>('OBSERVE_ONLY');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eligible = LEVELS.filter(
    level => level === 'OBSERVE_ONLY' || level !== currentLevel,
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await demoteTrustScope({ demotedTo, reason, scope });
        setReason('');
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to demote');
      }
    });
  };

  return (
    <Modal onOpenChange={setOpen} open={open}>
      <ModalTrigger asChild>
        <Button size="sm" variant="destructive">
          Demote
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Demote trust</ModalTitle>
          <ModalDescription>
            Current: <strong>{currentLevel}</strong> — {scope.hostname} /{' '}
            {scope.node ?? 'hostname'} / {scope.transition ?? 'any transition'}{' '}
            / {scope.actionType}
          </ModalDescription>
        </ModalHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="demotedTo">Demote to</Label>
            <select
              className="bg-background h-9 rounded-md border px-3 text-sm"
              id="demotedTo"
              onChange={event => setDemotedTo(event.target.value as TrustLevel)}
              value={demotedTo}
            >
              {eligible.map(level => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              onChange={event => setReason(event.target.value)}
              placeholder="e.g. captcha spike on 2026-04-22"
              required
              value={reason}
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <ModalFooter>
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="submit" variant="destructive">
              {isPending ? 'Demoting…' : 'Confirm demote'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
