'use client';

import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  createPairingCodeAction,
  revokeDesktopTokenAction,
} from '../actions';

export interface TokenRow {
  readonly id: string;
  readonly label: string;
  readonly deviceOs: string | null;
  readonly scopes: readonly string[];
  readonly issuedAt: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
}

interface PairingDisplay {
  readonly code: string;
  readonly expiresAt: string;
}

export function DesktopTokensClient({
  tokens,
}: {
  tokens: readonly TokenRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [pairing, setPairing] = useState<PairingDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePair = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createPairingCodeAction();
        setPairing({
          code: result.code,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Pairing failed');
      }
    });
  };

  const handleRevoke = (tokenId: string) => {
    startTransition(async () => {
      try {
        await revokeDesktopTokenAction(tokenId, 'manual revoke from admin');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Revoke failed');
      }
    });
  };

  const active = tokens.filter(t => !t.revokedAt);
  const revoked = tokens.filter(t => t.revokedAt);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Desktop devices</h1>
        <p className="text-muted-foreground text-sm">
          Long-lived API tokens issued to your desktop installs. Pair a new
          device by generating a code here, then entering it in the desktop
          app's "Pair device" dialog.
        </p>
      </header>

      <section className="rounded-md border p-4">
        <div className="flex w-fit items-center gap-3">
          <Button disabled={isPending} onClick={handlePair}>
            {isPending ? 'Generating...' : 'Generate pairing code'}
          </Button>
          {pairing ? (
            <div className="flex w-fit flex-col">
              <code className="text-2xl font-semibold tracking-widest">
                {pairing.code}
              </code>
              <span className="text-muted-foreground text-xs">
                Expires {new Date(pairing.expiresAt).toLocaleString()}
              </span>
            </div>
          ) : null}
        </div>
        {pairing ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Code is one-use and expires in 10 minutes. Enter it on the desktop
            app. Closing this page will NOT invalidate the code - it lives
            server-side until used or expired.
          </p>
        ) : null}
        {error ? (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Active devices</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map(token => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.label}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {token.deviceOs ?? '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex w-fit flex-wrap gap-1">
                      {token.scopes.map(scope => (
                        <Badge key={scope} variant="secondary">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(token.issuedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {token.lastUsedAt
                      ? new Date(token.lastUsedAt).toLocaleString()
                      : 'never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      disabled={isPending}
                      onClick={() => handleRevoke(token.id)}
                      size="sm"
                      variant="destructive"
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {active.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No active desktop devices.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      {revoked.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Revoked</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Revoked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revoked.map(token => (
                  <TableRow key={token.id}>
                    <TableCell>{token.label}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {token.revokedAt
                        ? new Date(token.revokedAt).toLocaleString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
