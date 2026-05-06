import type { SuppressionChecker } from './client.js';

export type SuppressionReason =
  | 'hard_bounce'
  | 'spam_complaint'
  | 'manual_unsubscribe'
  | 'invalid_address'
  | 'consent_withdrawn';

export interface SuppressionRecord {
  email_hash: string;
  reason: SuppressionReason;
  ts: Date;
  source?: string;
}

export interface SuppressionStore {
  has(email_hash: string): Promise<SuppressionRecord | null>;
  add(record: SuppressionRecord): Promise<void>;
}

export class DbSuppressionChecker implements SuppressionChecker {
  constructor(
    private store: SuppressionStore,
    private hashFn: (email: string) => Promise<string>,
  ) {}

  async isSuppressed(email: string): Promise<{ suppressed: boolean; reason?: string }> {
    const hash = await this.hashFn(email);
    const rec = await this.store.has(hash);
    if (rec) return { suppressed: true, reason: rec.reason };
    return { suppressed: false };
  }
}
