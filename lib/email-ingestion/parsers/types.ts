/**
 * Shape every ATS-specific confirmation-email parser must return.
 *
 * Parsers operate on a normalized message envelope: from, to, subject, body
 * (text preferred; HTML fallback is stripped to text by the worker before the
 * parser sees it).
 */
export interface ParsedConfirmation {
  readonly family: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters';
  readonly company: string | null;
  readonly role: string | null;
  readonly receivedAt: Date | null;
  /** Optional — some ATSes embed a URL back to the submission dashboard. */
  readonly dashboardUrl: string | null;
  /** Raw matched subject line, for audit trails. */
  readonly subject: string;
}

export interface EmailMessage {
  readonly uid: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly receivedAt: Date;
}

export type ConfirmationParser = (
  msg: EmailMessage,
) => ParsedConfirmation | null;
