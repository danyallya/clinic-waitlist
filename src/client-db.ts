import Dexie, { type Table } from 'dexie';
import type { WaitlistEntry, WaitlistInput } from '@/domain/waitlist';

export type OutboxItem = { id: string; payload: unknown; createdAt: number; attempts: number; lastError?: string };
export type WaitlistDraft = { id: 'active'; data: WaitlistInput; updatedAt: string };

export class LocalDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;
  drafts!: Table<WaitlistDraft, string>;
  entries!: Table<WaitlistEntry, string>;

  constructor() {
    super('idea-clinic-waitlist');
    this.version(1).stores({ outbox: 'id,createdAt,attempts' });
    this.version(2).stores({
      outbox: 'id,createdAt,attempts',
      drafts: 'id,updatedAt',
      entries: 'id,ticketCode,createdAt,preferredDate,status,cancelledAt',
    });
  }
}

export const localDatabase = new LocalDatabase();

export async function pruneExpiredCancelled(now = new Date()): Promise<void> {
  const retentionDays = 90;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await localDatabase.entries
    .where('cancelledAt')
    .below(cutoff)
    .and((entry) => entry.status === 'cancelled')
    .delete();
}
