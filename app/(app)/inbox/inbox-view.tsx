'use client';

import { Inbox as InboxIcon, Mail, MailOpen, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import { cn } from '@/lib/utils';
import {
  DataEventType,
  EventType,
  type InboxEmailReceivedPayload,
} from '@/types/events';

export interface InboxEmail {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
  status: string;
  detectedStatus: string | null;
  detectedCompany: string | null;
  detectedJobTitle: string | null;
  textBody: string | null;
  jobLeadId: string | null;
  jobLeadTitle: string | null;
  jobLeadCompany: string | null;
  submissionId: string | null;
  submissionStatus: string | null;
}

export interface InboxConfiguration {
  id: string;
  emailAddress: string;
  provider: string;
  isActive: boolean;
  label: string;
}

interface InboxViewProps {
  initialEmails: InboxEmail[];
  inboxes: InboxConfiguration[];
  trackingEmail: string | null;
  trackingForwardingEnabled: boolean;
  totalCount: number;
  unreadCount: number;
}

// "Unread" means the user hasn't opened the email in the inbox UI yet.
// (It used to be tied to AI analysis status, but that flipped emails to
// "read" the moment the analyzer finished — even if the user never saw
// them.) The actual read state is tracked client-side in localStorage.
function isUnreadEmail(email: InboxEmail, readIds: Set<string>): boolean {
  return !readIds.has(email.id);
}

const READ_EMAILS_STORAGE_KEY = 'inbox:read-email-ids';

function loadReadEmailIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_EMAILS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(id => typeof id === 'string')) {
      return new Set(parsed);
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

function persistReadEmailIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      READ_EMAILS_STORAGE_KEY,
      JSON.stringify(Array.from(ids).slice(-1000)),
    );
  } catch {
    /* ignore */
  }
}

type FilterTab =
  | 'all'
  | 'unread'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'rejected';

const STATUS_LABELS: Record<string, string> = {
  APPLICATION_RECEIVED: 'Received',
  APPLICATION_REJECTED: 'Rejected',
  INTERVIEW_SCHEDULED: 'Interview',
  INTERVIEW_FOLLOWUP: 'Follow-up',
  OFFER_MADE: 'Offer',
  OFFER_REJECTED: 'Offer Declined',
  ASSESSMENT_REQUEST: 'Assessment',
  GENERAL_UPDATE: 'Update',
  NOT_JOB_RELATED: 'Not Job-Related',
};

const STATUS_COLORS: Record<string, string> = {
  APPLICATION_RECEIVED: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  APPLICATION_REJECTED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  INTERVIEW_SCHEDULED:
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  INTERVIEW_FOLLOWUP:
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  OFFER_MADE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  OFFER_REJECTED: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  ASSESSMENT_REQUEST: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  GENERAL_UPDATE: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

const TAB_COUNT_CHIP_CLASS =
  'ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border/40 bg-background/70 px-1.5 text-[13px] font-semibold leading-none text-muted-foreground/80 shadow-xs transition-colors group-data-[state=active]:border-primary/30 group-data-[state=active]:bg-primary/20 group-data-[state=active]:text-primary/85 dark:border-white/10 dark:bg-white/[0.04] dark:text-muted-foreground dark:group-data-[state=active]:border-primary/30 dark:group-data-[state=active]:bg-primary/25 dark:group-data-[state=active]:text-primary/85';

function countDetectedStatuses(
  emails: readonly InboxEmail[],
  statuses: readonly string[],
): number {
  return emails.filter(email => statuses.includes(email.detectedStatus ?? ''))
    .length;
}

function TabCountChip({ count }: { count: number }) {
  if (count <= 0) return null;

  return <span className={TAB_COUNT_CHIP_CLASS}>{count.toLocaleString()}</span>;
}

// Match http(s) URLs and bare www. URLs. Stops at whitespace and angle
// brackets; trailing sentence punctuation (.,;:!?)]'") is trimmed back so
// we don't swallow the period that ends a sentence.
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"”’]+$/;

function linkifyText(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.replace(TRAILING_PUNCTUATION, '');
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    const href = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;
    nodes.push(
      <a
        key={`${start}-${trimmed}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
      >
        {trimmed}
      </a>,
    );
    const consumed = start + trimmed.length;
    lastIndex = consumed;
    if (consumed === start) URL_PATTERN.lastIndex = start + 1;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      now - date.getTime() > 365 * 24 * 60 * 60 * 1000 ? 'numeric' : undefined,
  });
}

export function InboxView({
  initialEmails,
  inboxes,
  trackingEmail,
  trackingForwardingEnabled,
  totalCount: initialTotalCount,
  unreadCount: initialUnreadCount,
}: InboxViewProps) {
  const router = useRouter();
  const activeInbox =
    inboxes.find(inbox => inbox.isActive) ?? inboxes[0] ?? null;
  const [emails, setEmails] = useState<InboxEmail[]>(initialEmails);
  const [tab, setTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEmails[0]?.id ?? null,
  );
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadEmailIds());

  const markEmailRead = useCallback((emailId: string) => {
    setReadIds(prev => {
      if (prev.has(emailId)) return prev;
      const next = new Set(prev);
      next.add(emailId);
      persistReadEmailIds(next);
      return next;
    });
  }, []);

  // Counts come from server-side aggregates initially; once Pusher
  // pushes a new email we keep them in sync against the local list so
  // the tab badges reflect the live state without a full refetch.
  const [extraCount, setExtraCount] = useState(0);

  const userChannel = useUserChannel();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [router]);

  useEffect(() => {
    setEmails(initialEmails);
    setExtraCount(0);
    setSelectedId(current =>
      current && initialEmails.some(email => email.id === current)
        ? current
        : (initialEmails[0]?.id ?? null),
    );
  }, [initialEmails]);

  const handleInboxEmailReceived = useCallback(
    (payload?: {
      readonly data: InboxEmailReceivedPayload;
      readonly type: DataEventType.INBOX_EMAIL_RECEIVED;
    }) => {
      if (!payload) return;
      if (payload.type !== DataEventType.INBOX_EMAIL_RECEIVED) return;
      const incoming = payload.data.email;
      setEmails(current => {
        const existingIndex = current.findIndex(
          item => item.id === incoming.id,
        );
        if (existingIndex !== -1) {
          const next = current.slice();
          next[existingIndex] = incoming;
          return next;
        }
        setExtraCount(value => value + 1);
        return [incoming, ...current];
      });
    },
    [],
  );

  useEvent<{
    readonly data: InboxEmailReceivedPayload;
    readonly type: DataEventType.INBOX_EMAIL_RECEIVED;
  }>(userChannel, EventType.DataUpdate, handleInboxEmailReceived);

  const totalCount = initialTotalCount + extraCount;
  const unreadCount = useMemo(
    () => emails.filter(email => isUnreadEmail(email, readIds)).length,
    [emails, readIds],
  );
  void initialUnreadCount;

  const filteredEmails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return emails.filter(email => {
      if (tab === 'unread' && readIds.has(email.id)) {
        return false;
      }
      if (
        tab === 'rejected' &&
        email.detectedStatus !== 'APPLICATION_REJECTED'
      ) {
        return false;
      }
      if (
        tab === 'interview' &&
        !['INTERVIEW_SCHEDULED', 'INTERVIEW_FOLLOWUP'].includes(
          email.detectedStatus ?? '',
        )
      ) {
        return false;
      }
      if (
        tab === 'assessment' &&
        email.detectedStatus !== 'ASSESSMENT_REQUEST'
      ) {
        return false;
      }
      if (tab === 'offer' && email.detectedStatus !== 'OFFER_MADE') {
        return false;
      }

      if (query) {
        const haystack = [
          email.subject,
          email.fromEmail,
          email.fromName,
          email.detectedCompany,
          email.detectedJobTitle,
          email.jobLeadTitle,
          email.jobLeadCompany,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [emails, tab, searchQuery, readIds]);

  const selectedEmail = useMemo(
    () =>
      filteredEmails.find(email => email.id === selectedId) ??
      filteredEmails[0] ??
      null,
    [filteredEmails, selectedId],
  );

  const primaryEmail = trackingEmail ?? activeInbox?.emailAddress ?? null;
  const secondaryCount =
    (trackingEmail ? inboxes.length : Math.max(0, inboxes.length - 1)) +
    (trackingEmail && activeInbox ? 0 : 0);
  const tabCounts = useMemo(
    () => ({
      assessment: countDetectedStatuses(emails, ['ASSESSMENT_REQUEST']),
      interview: countDetectedStatuses(emails, [
        'INTERVIEW_SCHEDULED',
        'INTERVIEW_FOLLOWUP',
      ]),
      offer: countDetectedStatuses(emails, ['OFFER_MADE']),
      rejected: countDetectedStatuses(emails, ['APPLICATION_REJECTED']),
    }),
    [emails],
  );
  const tabTriggerClassName =
    'group shrink-0 px-2.5 py-2 text-xs sm:px-3 sm:py-2.5 sm:text-sm data-[state=active]:text-primary/85';

  const inboxHeader = (
    <div className="shrink-0 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 px-1 pt-6 pb-6">
      <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
      {primaryEmail ? (
        <span className="min-w-0 truncate text-sm font-medium text-muted-foreground/70">
          {primaryEmail}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground/60">
          No tracking email yet
        </span>
      )}
      {trackingEmail && (
        <Badge
          variant="outline"
          className={
            trackingForwardingEnabled
              ? 'h-5 border border-emerald-500/25 bg-transparent px-1.5 text-[10px] text-emerald-300'
              : 'h-5 border border-amber-500/25 bg-transparent px-1.5 text-[10px] text-amber-300'
          }
        >
          {trackingForwardingEnabled ? 'Forwarding on' : 'Forwarding off'}
        </Badge>
      )}
      {secondaryCount > 0 && (
        <span className="text-xs text-muted-foreground/70">
          +{secondaryCount} more
        </span>
      )}
    </div>
  );

  const inboxToolbar = (
    <div className="shrink-0 px-2.5 pt-2.5 pb-0">
      <div className="flex min-h-11 flex-col gap-2 rounded-2xl bg-background/80 px-2.5 py-2 shadow-sm dark:bg-[#111115] lg:flex-row lg:items-center">
        <Tabs
          value={tab}
          onValueChange={value => setTab(value as FilterTab)}
          className="min-w-0 space-y-0 lg:flex-none"
        >
          <TabsList className="max-w-full gap-1 overflow-x-auto bg-transparent p-0">
            <TabsTrigger value="all" className={tabTriggerClassName}>
              All
              <TabCountChip count={totalCount} />
            </TabsTrigger>
            <TabsTrigger value="unread" className={tabTriggerClassName}>
              Unread
              <TabCountChip count={unreadCount} />
            </TabsTrigger>
            <TabsTrigger value="assessment" className={tabTriggerClassName}>
              Assessments
              <TabCountChip count={tabCounts.assessment} />
            </TabsTrigger>
            <TabsTrigger value="interview" className={tabTriggerClassName}>
              Interviews
              <TabCountChip count={tabCounts.interview} />
            </TabsTrigger>
            <TabsTrigger value="offer" className={tabTriggerClassName}>
              Offers
              <TabCountChip count={tabCounts.offer} />
            </TabsTrigger>
            <TabsTrigger value="rejected" className={tabTriggerClassName}>
              Rejections
              <TabCountChip count={tabCounts.rejected} />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/profile/application-tracking"
            aria-label="Inbox settings"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.05]"
          >
            <Settings className="size-3.5" />
          </Link>
          <div className="min-w-0 lg:w-72">
            <Input
              type="search"
              placeholder="Search subject, sender, or company..."
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="bg-background/70 shadow-xs dark:bg-white/[0.035]"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-full w-full flex-col">
      {inboxHeader}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-y border-border bg-background/85 shadow-[0_22px_70px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/5 dark:bg-zinc-900/85 dark:shadow-[0_32px_95px_-46px_rgba(0,0,0,0.75)]">
        {inboxToolbar}

        <div className="flex-1 w-full px-2.5 pt-2.5 overflow-hidden">
          <div className="grid h-full grid-cols-1 overflow-clip rounded-t-lg border-x-0 border-b-0 border-t border-t-border/30 bg-white shadow-lg shadow-black/10 dark:border-t-white/10 dark:bg-zinc-900 dark:shadow-black/25 lg:min-h-[620px] lg:grid-cols-[minmax(18rem,0.95fr)_minmax(0,1.45fr)]">
            {totalCount === 0 ? (
              <div className="col-span-full flex h-full min-h-72 flex-col items-center justify-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-border/40 bg-background/60 dark:border-white/10 dark:bg-white/[0.04]">
                  <InboxIcon className="size-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No emails yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  When companies respond to your job applications, their emails
                  will appear here.
                </p>
              </div>
            ) : (
              <>
                <section
                  aria-label="Email messages"
                  className="border-b border-border/40 bg-background/40 dark:border-white/10 dark:bg-[#111115] lg:border-b-0 lg:border-r"
                >
                  {filteredEmails.length === 0 ? (
                    <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-4 py-14 text-center">
                      <InboxIcon className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No emails match this filter.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/40 dark:divide-white/10">
                      {filteredEmails.map(email => {
                        const isSelected = selectedEmail?.id === email.id;
                        const isUnread = !readIds.has(email.id);
                        const Icon = isUnread ? Mail : MailOpen;
                        const sender = email.fromName ?? email.fromEmail;

                        return (
                          <li key={email.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(email.id);
                                markEmailRead(email.id);
                              }}
                              className={cn(
                                'flex w-full items-start gap-3 border-l-2 border-l-transparent px-3 py-3 text-left transition-colors hover:bg-muted/40 dark:hover:bg-white/[0.035]',
                                !isUnread && 'opacity-60 hover:opacity-100',
                                isSelected &&
                                  '!opacity-100 border-l-primary bg-primary/10 hover:bg-primary/15 dark:bg-primary/10',
                              )}
                            >
                              <Icon
                                className={cn(
                                  'mt-0.5 size-4 shrink-0',
                                  isUnread
                                    ? 'text-sky-400'
                                    : 'text-muted-foreground/70',
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      'truncate text-sm',
                                      isUnread
                                        ? 'font-semibold text-foreground'
                                        : 'font-normal text-muted-foreground',
                                    )}
                                  >
                                    {sender}
                                  </span>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatRelativeTime(email.receivedAt)}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    'mt-1.5 truncate text-sm',
                                    isUnread
                                      ? 'text-foreground/90'
                                      : 'text-muted-foreground/80',
                                  )}
                                >
                                  {email.subject}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {(email.jobLeadCompany ||
                                    email.detectedCompany) && (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {email.jobLeadCompany ??
                                        email.detectedCompany}
                                      {email.jobLeadTitle && (
                                        <span className="text-muted-foreground/55">
                                          {' · '}
                                          {email.jobLeadTitle}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {email.detectedStatus &&
                                    email.detectedStatus !==
                                      'NOT_JOB_RELATED' &&
                                    email.detectedStatus !==
                                      'APPLICATION_RECEIVED' && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'border px-2 py-0.5 text-[10px]',
                                          STATUS_COLORS[email.detectedStatus],
                                        )}
                                      >
                                        {STATUS_LABELS[email.detectedStatus] ??
                                          email.detectedStatus}
                                      </Badge>
                                    )}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {selectedEmail ? (
                  <article className="flex min-w-0 flex-col bg-card/60 dark:bg-[#15151a]">
                    <div className="flex flex-col gap-3 border-b border-border/40 p-3 dark:border-white/10 md:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-semibold leading-tight">
                          {selectedEmail.subject}
                        </h2>
                        {selectedEmail.detectedStatus &&
                          selectedEmail.detectedStatus !==
                            'NOT_JOB_RELATED' && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0 border px-2 py-0.5 text-[10px]',
                                STATUS_COLORS[selectedEmail.detectedStatus],
                              )}
                            >
                              {STATUS_LABELS[selectedEmail.detectedStatus] ??
                                selectedEmail.detectedStatus}
                            </Badge>
                          )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          <span className="text-foreground/80">From:</span>{' '}
                          {selectedEmail.fromName
                            ? `${selectedEmail.fromName} <${selectedEmail.fromEmail}>`
                            : selectedEmail.fromEmail}
                        </span>
                        <span>
                          {new Date(selectedEmail.receivedAt).toLocaleString()}
                        </span>
                      </div>
                      {(selectedEmail.detectedCompany ||
                        selectedEmail.detectedJobTitle ||
                        selectedEmail.jobLeadId) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {selectedEmail.detectedCompany && (
                            <Badge variant="secondary">
                              {selectedEmail.detectedCompany}
                            </Badge>
                          )}
                          {selectedEmail.detectedJobTitle && (
                            <Badge variant="secondary">
                              {selectedEmail.detectedJobTitle}
                            </Badge>
                          )}
                          {selectedEmail.jobLeadId && (
                            <Button asChild size="xs" variant="outline">
                              <Link href={`/leads/${selectedEmail.jobLeadId}`}>
                                View lead
                                {selectedEmail.jobLeadTitle &&
                                  `: ${selectedEmail.jobLeadTitle}`}
                              </Link>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-auto p-3 md:p-4">
                      {selectedEmail.textBody ? (
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground/85">
                          {linkifyText(selectedEmail.textBody)}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No plaintext body available for this email.
                        </p>
                      )}
                    </div>
                  </article>
                ) : (
                  <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                    Select an email to read.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

InboxView.displayName = 'InboxView';
