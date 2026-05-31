export interface BucketConfig {
  capacity: number;
  dayLimit?: number | null;
  refillRatePerSec: number;
}

export interface BucketState extends BucketConfig {
  dayCount: number;
  dayResetAt: Date;
  lastRefilledAt: Date;
  tokens: number;
}

export type AcquireDenialReason = 'INSUFFICIENT_TOKENS' | 'DAY_LIMIT_REACHED';

export interface AcquireResult {
  dayRemaining: number | null;
  ok: boolean;
  reason?: AcquireDenialReason;
  retryAfterMs?: number;
  state: BucketState;
  tokensRemaining: number;
}

export interface AcquireInput {
  actionType: string;
  config?: BucketConfig;
  cost?: number;
  hostname: string;
  now?: Date;
}
