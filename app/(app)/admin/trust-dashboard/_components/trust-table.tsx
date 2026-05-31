'use client';

import { useTransition } from 'react';

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
import type { TrustLevel, TrustScope } from '@/lib/runtime-trust-ladder';

import { clearTrustOverride } from '../actions';

import { DemoteDialog } from './demote-dialog';

export interface TrustRowVM {
  readonly key: string;
  readonly scope: TrustScope;
  readonly computedLevel: TrustLevel;
  readonly effectiveLevel: TrustLevel;
  readonly lastChangeReason: string;
  readonly lastChangeAt: string | null;
  readonly overriddenTo: TrustLevel | null;
  readonly overrideId: string | null;
}

const LEVEL_VARIANT: Record<
  TrustLevel,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ACTION_WITH_CONFIRMATION: 'default',
  AUTO_STEP_GUARDED: 'default',
  FULL_AUTO: 'default',
  OBSERVE_ONLY: 'outline',
  SUGGEST_ONLY: 'secondary',
};

export function TrustTable({ rows }: { rows: readonly TrustRowVM[] }) {
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        No trust rows yet. Scopes appear here after a manual demote or once
        the runtime emits scoped events.
      </p>
    );
  }

  const handleClear = (overrideId: string) => {
    startTransition(async () => {
      await clearTrustOverride(overrideId);
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Scope</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Computed</TableHead>
          <TableHead>Effective</TableHead>
          <TableHead>Last change</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.key}>
            <TableCell>
              <div className="font-medium">{row.scope.hostname}</div>
              <div className="text-muted-foreground text-xs">
                {row.scope.atsFamily}
                {' · '}
                {row.scope.node ?? 'any node'}
                {' · '}
                {row.scope.transition ?? 'any transition'}
              </div>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {row.scope.actionType}
            </TableCell>
            <TableCell>
              <Badge variant={LEVEL_VARIANT[row.computedLevel]}>
                {row.computedLevel}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={LEVEL_VARIANT[row.effectiveLevel]}>
                {row.effectiveLevel}
              </Badge>
              {row.overriddenTo ? (
                <div className="text-muted-foreground text-xs">
                  override: {row.overriddenTo}
                </div>
              ) : null}
            </TableCell>
            <TableCell>
              <div className="text-sm">{row.lastChangeReason}</div>
              {row.lastChangeAt ? (
                <div className="text-muted-foreground text-xs">
                  {new Date(row.lastChangeAt).toLocaleString()}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex w-fit justify-end gap-2">
                {row.overrideId ? (
                  <Button
                    disabled={isPending}
                    onClick={() => handleClear(row.overrideId as string)}
                    size="sm"
                    variant="outline"
                  >
                    Clear override
                  </Button>
                ) : null}
                <DemoteDialog
                  currentLevel={row.effectiveLevel}
                  scope={row.scope}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
