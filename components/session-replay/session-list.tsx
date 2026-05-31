import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { RuntimeSessionListItem } from './types';

interface SessionListProps {
  sessions: RuntimeSessionListItem[];
}

export function SessionList({ sessions }: SessionListProps) {
  return (
    <Card>
      <CardHeader>
        <CardSummary>
          <CardTitle>Runtime sessions</CardTitle>
          <CardDescription>
            Recent supervised runtime sessions with replay artifacts.
          </CardDescription>
        </CardSummary>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Artifacts</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No runtime sessions recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map(session => (
                <TableRow key={session.id}>
                  <TableCell className="max-w-[22rem]">
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">
                        {session.jobTitle ?? 'Untitled application'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {session.company ?? session.hostname ?? 'Unknown host'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{session.status}</Badge>
                  </TableCell>
                  <TableCell>{session.eventCount}</TableCell>
                  <TableCell>{session.artifactCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(session.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/sessions/${session.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
