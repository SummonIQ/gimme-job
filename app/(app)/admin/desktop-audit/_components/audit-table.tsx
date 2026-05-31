'use client';

import { useState } from 'react';

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

export interface AuditRow {
  readonly id: string;
  readonly createdAt: string;
  readonly toolName: string;
  readonly action: string;
  readonly outcome: string | null;
  readonly payload: unknown;
  readonly redactedKeys: readonly string[];
  readonly errorMessage: string | null;
  readonly durationMs: number | null;
  readonly jobLeadId: string | null;
  readonly desktopSessionId: string | null;
  readonly runtimeSessionId: string | null;
}

function outcomeBadgeVariant(
  outcome: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (outcome === 'error') return 'destructive';
  if (outcome === 'ok') return 'secondary';
  return 'outline';
}

function Row({ row }: { row: AuditRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow>
        <TableCell className="text-muted-foreground whitespace-nowrap">
          {new Date(row.createdAt).toLocaleString()}
        </TableCell>
        <TableCell className="font-mono text-xs">{row.toolName}</TableCell>
        <TableCell>
          <Badge variant="outline">{row.action}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={outcomeBadgeVariant(row.outcome)}>
            {row.outcome ?? '-'}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {row.durationMs === null ? '-' : `${row.durationMs}ms`}
        </TableCell>
        <TableCell className="font-mono text-xs">
          {row.jobLeadId ?? '-'}
        </TableCell>
        <TableCell>
          <Button
            onClick={() => setExpanded(e => !e)}
            size="sm"
            variant="outline"
          >
            {expanded ? 'Hide' : 'Expand'}
          </Button>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={7}>
            <div className="space-y-2 p-2 text-xs">
              {row.errorMessage ? (
                <div>
                  <strong>Error:</strong> {row.errorMessage}
                </div>
              ) : null}
              {row.redactedKeys.length > 0 ? (
                <div>
                  <strong>Redacted keys:</strong>{' '}
                  {row.redactedKeys.map(k => (
                    <Badge className="mr-1" key={k} variant="secondary">
                      {k}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div>
                <strong>Session:</strong>{' '}
                {row.desktopSessionId ?? 'none'}
                {row.runtimeSessionId ? (
                  <>
                    {' - runtime: '}
                    {row.runtimeSessionId}
                  </>
                ) : null}
              </div>
              <pre className="bg-muted overflow-auto p-2 text-xs">
                {JSON.stringify(row.payload, null, 2)}
              </pre>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function AuditTable({ rows }: { rows: readonly AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        No desktop audit rows yet for the current filter.
      </p>
    );
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Tool</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="text-right">Payload</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <Row key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
