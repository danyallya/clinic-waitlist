import { describe, expect, it } from 'vitest';
import { cancelWaitlistEntry, createWaitlistEntry, validateWaitlist, type WaitlistInput } from './waitlist';

const now = new Date('2026-10-28T08:00:00.000Z');
const validInput: WaitlistInput = { preferredDate: '2026-10-28', consentConfirmed: true };

describe('clinic waitlist domain', () => {
  it('accepts today as the preferred-date boundary and creates a local waiting ticket', () => {
    const entry = createWaitlistEntry(validInput, '12345678-aaaa-bbbb-cccc-123456789abc', now);
    expect(entry.ticketCode).toBe('CW-12345678AAAA');
    expect(entry.status).toBe('waiting');
    expect(entry.createdAt).toBe(now.toISOString());
  });

  it('requires patient consent and rejects malformed or past dates', () => {
    expect(validateWaitlist({ preferredDate: '', consentConfirmed: false }, now).map((issue) => issue.field)).toEqual(['consentConfirmed']);
    expect(validateWaitlist({ preferredDate: '2026-02-30', consentConfirmed: true }, now).map((issue) => issue.field)).toEqual(['preferredDate']);
    expect(validateWaitlist({ preferredDate: '2026-10-27', consentConfirmed: true }, now).map((issue) => issue.field)).toEqual(['preferredDate']);
  });

  it('keeps cancellation terminal and records its timestamp', () => {
    const entry = createWaitlistEntry(validInput, '12345678-aaaa-bbbb-cccc-123456789abc', now);
    const cancelled = cancelWaitlistEntry(entry, new Date('2026-10-28T09:00:00.000Z'));
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBe('2026-10-28T09:00:00.000Z');
    expect(() => cancelWaitlistEntry(cancelled, now)).toThrow('Only a waiting ticket can be cancelled.');
  });

  it('still allows cancellation when the device clock moves backward', () => {
    const entry = createWaitlistEntry(validInput, '12345678-aaaa-bbbb-cccc-123456789abc', now);
    const cancelled = cancelWaitlistEntry(entry, new Date('2026-10-28T07:59:59.999Z'));
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBe('2026-10-28T07:59:59.999Z');
  });

  it('survives JSON serialization without patient or contact fields', () => {
    const entry = createWaitlistEntry(validInput, '12345678-aaaa-bbbb-cccc-123456789abc', now);
    const restored = JSON.parse(JSON.stringify(entry));
    expect(restored).toEqual(entry);
    expect(restored).not.toHaveProperty('patientName');
    expect(restored).not.toHaveProperty('phone');
    expect(restored).not.toHaveProperty('healthReason');
  });
});
