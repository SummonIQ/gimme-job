'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmationInboxProvider } from '@/generated/prisma/browser';

import { createConfirmationInbox } from '../actions';

export function InboxForm() {
  const [provider, setProvider] = useState<ConfirmationInboxProvider>(
    ConfirmationInboxProvider.IMAP,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isImap = provider === ConfirmationInboxProvider.IMAP;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await createConfirmationInbox({
          emailAddress: String(form.get('emailAddress') ?? ''),
          imapHost: isImap ? String(form.get('imapHost') ?? '') : undefined,
          imapPort: isImap ? Number(form.get('imapPort')) || undefined : undefined,
          imapSecure: isImap
            ? form.get('imapSecure') === 'on'
            : undefined,
          imapUsername: isImap
            ? String(form.get('imapUsername') ?? '')
            : undefined,
          label: String(form.get('label') ?? ''),
          pollingCadenceSeconds:
            Number(form.get('pollingCadenceSeconds')) || undefined,
          provider,
          scope: String(form.get('scope') ?? '') || undefined,
          secret: String(form.get('secret') ?? ''),
        });
        (event.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add inbox');
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" placeholder="Primary inbox" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="emailAddress">Email address</Label>
        <Input
          id="emailAddress"
          name="emailAddress"
          placeholder="apps@example.com"
          required
          type="email"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="provider">Provider</Label>
        <select
          className="bg-background h-9 rounded-md border px-3 text-sm"
          id="provider"
          name="provider"
          onChange={event =>
            setProvider(event.target.value as ConfirmationInboxProvider)
          }
          value={provider}
        >
          <option value={ConfirmationInboxProvider.IMAP}>IMAP (app password)</option>
          <option value={ConfirmationInboxProvider.GMAIL}>Gmail (OAuth)</option>
          <option value={ConfirmationInboxProvider.OUTLOOK}>Outlook (OAuth)</option>
        </select>
      </div>

      {isImap ? (
        <fieldset className="grid gap-4 rounded-md border p-4">
          <legend className="px-2 text-sm font-medium">IMAP details</legend>
          <div className="grid gap-2">
            <Label htmlFor="imapHost">Host</Label>
            <Input
              id="imapHost"
              name="imapHost"
              placeholder="imap.example.com"
              required={isImap}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="imapPort">Port</Label>
              <Input
                defaultValue={993}
                id="imapPort"
                min={1}
                name="imapPort"
                required={isImap}
                type="number"
              />
            </div>
            <div className="flex items-end gap-2">
              <Input
                defaultChecked
                id="imapSecure"
                name="imapSecure"
                type="checkbox"
              />
              <Label htmlFor="imapSecure">Use TLS</Label>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="imapUsername">Username</Label>
            <Input
              id="imapUsername"
              name="imapUsername"
              placeholder="apps@example.com"
              required={isImap}
            />
          </div>
        </fieldset>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="scope">OAuth scope (optional)</Label>
          <Input
            id="scope"
            name="scope"
            placeholder="https://mail.google.com/"
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="secret">
          {isImap ? 'App password' : 'Refresh token (access_token\\nrefresh_token for both)'}
        </Label>
        <Input
          id="secret"
          name="secret"
          placeholder={isImap ? '••••••••' : 'ya29.… or 1//…'}
          required
          type="password"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="pollingCadenceSeconds">Poll cadence (seconds)</Label>
        <Input
          defaultValue={300}
          id="pollingCadenceSeconds"
          min={30}
          name="pollingCadenceSeconds"
          type="number"
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button className="w-fit" disabled={isPending} type="submit">
        {isPending ? 'Adding…' : 'Add inbox'}
      </Button>
    </form>
  );
}
