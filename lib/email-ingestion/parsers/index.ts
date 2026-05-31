import { parseAshbyConfirmation } from './ashby';
import { parseGreenhouseConfirmation } from './greenhouse';
import { parseLeverConfirmation } from './lever';
import type { ConfirmationParser, ParsedConfirmation, EmailMessage } from './types';

export type { ConfirmationParser, EmailMessage, ParsedConfirmation };

export const CONFIRMATION_PARSERS: readonly ConfirmationParser[] = [
  parseGreenhouseConfirmation,
  parseLeverConfirmation,
  parseAshbyConfirmation,
];

export function parseConfirmation(
  msg: EmailMessage,
): ParsedConfirmation | null {
  for (const parse of CONFIRMATION_PARSERS) {
    const result = parse(msg);
    if (result) return result;
  }
  return null;
}
