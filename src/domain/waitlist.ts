export type WaitlistStatus = 'waiting' | 'cancelled';

export type WaitlistInput = {
  preferredDate: string;
  consentConfirmed: boolean;
};

export type WaitlistEntry = {
  id: string;
  ticketCode: string;
  createdAt: string;
  preferredDate: string;
  status: WaitlistStatus;
  consentConfirmed: true;
  consentedAt: string;
  cancelledAt?: string;
};

export type WaitlistField = keyof WaitlistInput;
export type WaitlistIssue = { field: WaitlistField; message: string };

export function localDateValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateWaitlist(input: WaitlistInput, now = new Date()): WaitlistIssue[] {
  const issues: WaitlistIssue[] = [];
  if (input.preferredDate && !isValidDateOnly(input.preferredDate)) {
    issues.push({ field: 'preferredDate', message: 'Enter a valid preferred date.' });
  } else if (input.preferredDate && input.preferredDate < localDateValue(now)) {
    issues.push({ field: 'preferredDate', message: 'Preferred date cannot be in the past.' });
  }
  if (!input.consentConfirmed) {
    issues.push({ field: 'consentConfirmed', message: 'Confirm the patient agreed to this local ticket.' });
  }
  return issues;
}

export function createWaitlistEntry(input: WaitlistInput, id: string, now = new Date()): WaitlistEntry {
  if (validateWaitlist(input, now).length) throw new Error('Cannot create a waitlist ticket from invalid input.');
  const timestamp = now.toISOString();
  return {
    id,
    ticketCode: `CW-${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`,
    createdAt: timestamp,
    preferredDate: input.preferredDate,
    status: 'waiting',
    consentConfirmed: true,
    consentedAt: timestamp,
  };
}

export function cancelWaitlistEntry(entry: WaitlistEntry, now = new Date()): WaitlistEntry {
  if (entry.status !== 'waiting') throw new Error('Only a waiting ticket can be cancelled.');
  return { ...entry, status: 'cancelled', cancelledAt: now.toISOString() };
}
