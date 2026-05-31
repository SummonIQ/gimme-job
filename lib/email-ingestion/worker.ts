import { db } from '@/lib/db/client';
import {
  ApplicationConfirmationState,
  type ConfirmationInbox,
} from '@/generated/prisma/client';

import { parseConfirmation } from './parsers';
import type { EmailMessage, ParsedConfirmation } from './parsers';
import { loadAuthenticatedInbox, recordPoll } from './auth';

/**
 * Abstract IMAP-like client. Production wiring uses a real IMAP lib
 * (imapflow / node-imap) implementing this interface; tests pass an in-memory
 * implementation so the full loop can run without a network.
 */
export interface InboxClient {
  /**
   * Fetch messages whose UID is strictly greater than `sinceUid`. If
   * `sinceUid` is null, return the most recent `limit` messages.
   */
  fetchMessages(opts: {
    readonly sinceUid: string | null;
    readonly limit: number;
  }): Promise<readonly EmailMessage[]>;
}

/**
 * Factory signature for resolving a running InboxClient from the decrypted
 * credentials. The worker calls it; production wires a real IMAP connection,
 * tests wire a mock.
 */
export type InboxClientFactory = (
  inbox: ConfirmationInbox,
) => Promise<InboxClient>;

const MATCH_WINDOW_DAYS = 14;
const DEFAULT_FETCH_LIMIT = 50;

export interface WorkerResult {
  readonly inboxId: string;
  readonly messagesFetched: number;
  readonly messagesParsed: number;
  readonly submissionsMatched: number;
  readonly matchedSubmissionIds: readonly string[];
  readonly lastSeenUid: string | null;
}

export interface PollInboxOptions {
  readonly inboxId: string;
  readonly clientFactory: InboxClientFactory;
  readonly now?: Date;
  readonly fetchLimit?: number;
}

function highestUid(
  a: string | null,
  b: string | null | undefined,
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return bNum > aNum ? b : a;
  }
  return a.localeCompare(b) < 0 ? b : a;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Pure matcher — kept separate from the DB call so unit tests can drive it
 * without fixtures. Given a parsed confirmation and a list of candidate
 * submissions, returns the submission id that best matches (or null).
 */
export function matchConfirmationToSubmission(
  parsed: ParsedConfirmation,
  candidates: ReadonlyArray<{
    readonly id: string;
    readonly company: string | null;
    readonly jobTitle: string;
    readonly submittedAt: Date | null;
  }>,
): string | null {
  const parsedCompany = normalize(parsed.company);
  const parsedRole = normalize(parsed.role);

  let best: { id: string; score: number; submittedAt: Date | null } | null =
    null;

  for (const candidate of candidates) {
    const candidateCompany = normalize(candidate.company);
    const candidateRole = normalize(candidate.jobTitle);

    let score = 0;
    if (parsedCompany && candidateCompany) {
      if (candidateCompany === parsedCompany) score += 3;
      else if (
        candidateCompany.includes(parsedCompany) ||
        parsedCompany.includes(candidateCompany)
      ) {
        score += 2;
      }
    }
    if (parsedRole && candidateRole) {
      if (candidateRole === parsedRole) score += 3;
      else if (
        candidateRole.includes(parsedRole) ||
        parsedRole.includes(candidateRole)
      ) {
        score += 2;
      }
    }

    if (score < 2) continue;

    if (
      !best ||
      score > best.score ||
      // Prefer the most recently submitted candidate on tie.
      (score === best.score &&
        (candidate.submittedAt?.getTime() ?? 0) >
          (best.submittedAt?.getTime() ?? 0))
    ) {
      best = { id: candidate.id, score, submittedAt: candidate.submittedAt };
    }
  }

  return best?.id ?? null;
}

async function loadCandidateSubmissions(userId: string, now: Date) {
  const windowStart = new Date(
    now.getTime() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const rows = await db.applicationSubmission.findMany({
    include: {
      jobLead: {
        include: {
          jobListing: { select: { company: true, title: true } },
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
    where: {
      confirmationState: ApplicationConfirmationState.PENDING,
      submittedAt: { gte: windowStart, not: null },
      userId,
    },
  });

  return rows.map(row => ({
    company: row.jobLead.jobListing.company,
    id: row.id,
    jobTitle: row.jobLead.jobListing.title,
    submittedAt: row.submittedAt,
  }));
}

export async function pollInbox({
  inboxId,
  clientFactory,
  now = new Date(),
  fetchLimit = DEFAULT_FETCH_LIMIT,
}: PollInboxOptions): Promise<WorkerResult> {
  const inbox = await db.confirmationInbox.findUniqueOrThrow({
    where: { id: inboxId },
  });
  // Decrypt credentials up-front so we fail fast on missing env/keys.
  await loadAuthenticatedInbox(inboxId);

  const client = await clientFactory(inbox);
  const messages = await client.fetchMessages({
    limit: fetchLimit,
    sinceUid: inbox.lastSeenUid,
  });

  let messagesParsed = 0;
  const matched: string[] = [];
  const alreadyMatched = new Set<string>();
  let newestUid: string | null = inbox.lastSeenUid;

  // Load candidate submissions once — cheaper than querying per message.
  const candidates = await loadCandidateSubmissions(inbox.userId, now);

  for (const msg of messages) {
    newestUid = highestUid(newestUid, msg.uid);
    const parsed = parseConfirmation(msg);
    if (!parsed) continue;
    messagesParsed += 1;

    const hitId = matchConfirmationToSubmission(
      parsed,
      candidates.filter(c => !alreadyMatched.has(c.id)),
    );
    if (!hitId) continue;

    await db.$transaction([
      db.applicationSubmission.update({
        data: {
          confirmationState: ApplicationConfirmationState.EMAIL_CONFIRMED,
          verifiedAt: msg.receivedAt,
        },
        where: { id: hitId },
      }),
      db.automationAuditLog.create({
        data: {
          action: 'EMAIL_CONFIRMATION_MATCHED',
          actionType: 'RECONCILE',
          applicationSubmissionId: hitId,
          metadata: {
            confirmationSubject: parsed.subject,
            emailUid: msg.uid,
            family: parsed.family,
            inboxId,
            matchedAt: now.toISOString(),
            parsedCompany: parsed.company,
            parsedRole: parsed.role,
          },
          userId: inbox.userId,
        },
      }),
    ]);

    matched.push(hitId);
    alreadyMatched.add(hitId);
  }

  await recordPoll(inboxId, newestUid, now);

  return {
    inboxId,
    lastSeenUid: newestUid,
    matchedSubmissionIds: matched,
    messagesFetched: messages.length,
    messagesParsed,
    submissionsMatched: matched.length,
  };
}
