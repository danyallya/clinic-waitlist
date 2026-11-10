'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { localDatabase, pruneExpiredCancelled, type WaitlistDraft } from '@/client-db';
import { cancelWaitlistEntry, createWaitlistEntry, localDateValue, validateWaitlist, type WaitlistEntry, type WaitlistField, type WaitlistInput, type WaitlistIssue } from '@/domain/waitlist';

type DraftState = 'loading' | 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

function emptyInput(): WaitlistInput {
  return { preferredDate: '', consentConfirmed: false };
}

function formatDate(value: string): string {
  if (!value) return 'No date preference';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function HomePage() {
  const [input, setInput] = useState<WaitlistInput>(emptyInput);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [draftState, setDraftState] = useState<DraftState>('loading');
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [issues, setIssues] = useState<WaitlistIssue[]>([]);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const hydrated = useRef(false);
  const skipNextDraftSave = useRef(false);
  const draftSaveTimer = useRef<number | null>(null);
  const pendingDraftWrite = useRef<Promise<void> | null>(null);

  async function settleDraftWrite() {
    if (draftSaveTimer.current !== null) {
      window.clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }
    await pendingDraftWrite.current;
  }

  async function refreshEntries() {
    await pruneExpiredCancelled();
    const savedEntries = await localDatabase.entries.orderBy('createdAt').reverse().toArray();
    setEntries(savedEntries);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await pruneExpiredCancelled();
        const [draft, savedEntries] = await Promise.all([
          localDatabase.drafts.get('active'),
          localDatabase.entries.orderBy('createdAt').reverse().toArray(),
        ]);
        if (cancelled) return;
        if (draft) setInput(draft.data);
        setEntries(savedEntries);
        hydrated.current = true;
        setDraftState(draft ? 'saved' : 'idle');
      } catch {
        if (!cancelled) {
          hydrated.current = true;
          setDraftState('error');
          setStorageError('Local storage is unavailable in this browser. No ticket has been saved.');
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    setDraftState('unsaved');
    const timer = window.setTimeout(() => {
      draftSaveTimer.current = null;
      const previousWrite = pendingDraftWrite.current;
      const write = (async () => {
        setDraftState('saving');
        try {
          await previousWrite;
          const draft: WaitlistDraft = { id: 'active', data: input, updatedAt: new Date().toISOString() };
          await localDatabase.drafts.put(draft);
          setDraftState('saved');
          setStorageError('');
        } catch {
          setDraftState('error');
          setStorageError('The draft could not be saved on this device.');
        }
      })();
      pendingDraftWrite.current = write;
      void write.finally(() => {
        if (pendingDraftWrite.current === write) pendingDraftWrite.current = null;
      });
    }, 450);
    draftSaveTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (draftSaveTimer.current === timer) draftSaveTimer.current = null;
    };
  }, [input]);

  function updateField(field: WaitlistField, value: string | boolean) {
    setInput((current) => ({ ...current, [field]: value }));
    setIssues([]);
    setNotice('');
  }

  function startReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextIssues = validateWaitlist(input);
    setIssues(nextIssues);
    if (nextIssues.length) {
      document.getElementById(`field-${nextIssues[0].field}`)?.focus();
      return;
    }
    setStep('review');
  }

  async function saveTicket() {
    const now = new Date();
    const nextIssues = validateWaitlist(input, now);
    if (nextIssues.length) {
      setIssues(nextIssues);
      setStep('form');
      return;
    }

    setIsBusy(true);
    await settleDraftWrite();
    try {
      const entry = createWaitlistEntry(input, crypto.randomUUID(), now);
      await localDatabase.transaction('rw', localDatabase.entries, localDatabase.drafts, async () => {
        await localDatabase.entries.add(entry);
        await localDatabase.drafts.delete('active');
      });
    } catch {
      setStorageError('The ticket could not be saved. The local draft is still available.');
      setDraftState('error');
      setIsBusy(false);
      return;
    }

    skipNextDraftSave.current = true;
    setInput(emptyInput());
    setIssues([]);
    setStep('form');
    setDraftState('idle');
    setIsBusy(false);
    setNotice('Ticket added to this device only. No clinic was contacted and no notification was sent.');
    setStorageError('');
    try {
      await refreshEntries();
    } catch {
      setStorageError('The ticket was saved on this device, but the list could not be refreshed. Reload to confirm it.');
    }
  }

  async function cancelTicket(id: string) {
    setIsBusy(true);
    try {
      await localDatabase.transaction('rw', localDatabase.entries, async () => {
        const current = await localDatabase.entries.get(id);
        if (!current) throw new Error('Ticket was not found.');
        await localDatabase.entries.put(cancelWaitlistEntry(current));
      });
    } catch {
      setStorageError('The ticket could not be cancelled locally. No clinic appointment was changed.');
      setIsBusy(false);
      return;
    }
    setPendingCancel(null);
    setNotice('Ticket marked cancelled on this device. No clinic was contacted.');
    setStorageError('');
    setIsBusy(false);
    try {
      await refreshEntries();
    } catch {
      setStorageError('The ticket was cancelled locally, but the list could not be refreshed. Reload to confirm it.');
    }
  }

  async function deleteCancelledTicket(id: string) {
    setIsBusy(true);
    try {
      await localDatabase.transaction('rw', localDatabase.entries, async () => {
        const current = await localDatabase.entries.get(id);
        if (!current || current.status !== 'cancelled') throw new Error('Only a cancelled local ticket can be deleted.');
        await localDatabase.entries.delete(id);
      });
    } catch {
      setStorageError('The cancelled ticket could not be deleted from this device.');
      setIsBusy(false);
      return;
    }
    setPendingDelete(null);
    setNotice('Cancelled ticket deleted from this device.');
    setStorageError('');
    setIsBusy(false);
    try {
      await refreshEntries();
    } catch {
      setStorageError('The ticket was deleted locally, but the list could not be refreshed. Reload to confirm it.');
    }
  }

  async function discardDraft() {
    setIsBusy(true);
    await settleDraftWrite();
    try {
      await localDatabase.drafts.delete('active');
      skipNextDraftSave.current = true;
      setInput(emptyInput());
      setIssues([]);
      setStep('form');
      setDraftState('idle');
      setStorageError('');
      setNotice('Draft discarded from this device.');
    } catch {
      setStorageError('The draft could not be discarded from this device.');
      setDraftState('error');
    }
    setIsBusy(false);
  }

  const issueFor = (field: WaitlistField) => issues.find((issue) => issue.field === field)?.message;
  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60';
  const buttonClass = 'rounded-lg bg-sky-800 px-4 py-2 font-semibold text-white hover:bg-sky-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-800">Clinic Waitlist · local prototype</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">A private, local waitlist ticket</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-700">Create a pseudonymous ticket with an optional preferred date. No patient name, contact detail or health reason is collected, and no clinic or patient is contacted.</p>
        </header>

        <section aria-label="Storage and sync status" className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Draft on this device</h2>
            <p className="mt-1 text-sm text-slate-700" aria-live="polite">
              {draftState === 'loading' && 'Checking local storage…'}
              {draftState === 'idle' && 'No unsaved changes'}
              {draftState === 'unsaved' && 'Unsaved changes'}
              {draftState === 'saving' && 'Saving draft locally…'}
              {draftState === 'saved' && 'Draft saved locally'}
              {draftState === 'error' && 'Local save failed'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Sync</h2>
            <p className="mt-1 text-sm text-slate-700">Local only · never uploaded · not shared with another device</p>
          </div>
        </section>

        {storageError && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{storageError}</p>}
        {notice && <p aria-live="polite" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {step === 'form' ? (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold">New waitlist ticket</h2>
                <p className="mt-1 text-sm text-slate-600">Do not enter a name, phone number, email, health reason or other identifying detail.</p>
              </div>
              {issues.length > 0 && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">Please fix the highlighted fields before reviewing.</div>}
              <form onSubmit={startReview} className="space-y-5">
                <label className="block text-sm font-medium" htmlFor="field-preferredDate">Preferred date (optional)
                  <input id="field-preferredDate" type="date" min={localDateValue()} className={fieldClass} value={input.preferredDate} disabled={isBusy} onChange={(event) => updateField('preferredDate', event.target.value)} aria-invalid={Boolean(issueFor('preferredDate'))} aria-describedby={issueFor('preferredDate') ? 'error-preferredDate' : 'help-preferredDate'} />
                  {issueFor('preferredDate') ? <span id="error-preferredDate" className="mt-1 block text-sm text-red-800">{issueFor('preferredDate')}</span> : <span id="help-preferredDate" className="mt-1 block font-normal text-slate-600">The ticket records when it was created. This optional date is only a preference, not a booked appointment.</span>}
                </label>

                <div>
                  <label className="flex items-start gap-3 text-sm leading-6" htmlFor="field-consentConfirmed">
                    <input id="field-consentConfirmed" type="checkbox" className="mt-1 size-4 accent-sky-800" checked={input.consentConfirmed} disabled={isBusy} onChange={(event) => updateField('consentConfirmed', event.target.checked)} aria-invalid={Boolean(issueFor('consentConfirmed'))} aria-describedby={issueFor('consentConfirmed') ? 'error-consentConfirmed' : 'help-consentConfirmed'} />
                    <span>I confirm the patient agreed to storing this pseudonymous ticket on this device. The app cannot verify consent. No message or notification will be sent.</span>
                  </label>
                  {issueFor('consentConfirmed') ? <span id="error-consentConfirmed" className="mt-1 block text-sm text-red-800">{issueFor('consentConfirmed')}</span> : <span id="help-consentConfirmed" className="sr-only">Consent confirmation is required before review.</span>}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                  <button type="submit" className={buttonClass} disabled={isBusy || draftState === 'loading' || draftState === 'error'}>Review ticket</button>
                  <button type="button" onClick={() => void discardDraft()} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={isBusy}>Discard draft</button>
                </div>
              </form>
            </>
          ) : (
            <div>
              <h2 className="text-xl font-bold">Review before adding to the local queue</h2>
              <p className="mt-1 text-sm text-slate-600">This records a local waitlist ticket only. It does not book an appointment, contact a clinic or send a notification.</p>
              <dl className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase text-slate-600">Requested at</dt><dd className="mt-1">When you confirm</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-600">Preferred date</dt><dd className="mt-1">{formatDate(input.preferredDate)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-600">Consent</dt><dd className="mt-1">User confirmed permission for a pseudonymous local ticket</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => setStep('form')} disabled={isBusy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Back to edit</button>
                <button type="button" onClick={() => void saveTicket()} disabled={isBusy} className={buttonClass}>Confirm and add ticket</button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="tickets-heading" className="space-y-4">
          <div>
            <h2 id="tickets-heading" className="text-xl font-bold">Tickets on this device</h2>
            <p className="mt-1 text-sm text-slate-600">A ticket code is a local label, not proof of identity or an authorization token.</p>
          </div>
          {entries.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No local waitlist tickets yet.</p> : entries.map((entry) => (
            <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Ticket {entry.ticketCode}</h3>
                  <p className="mt-1 text-sm text-slate-600">Created {formatTimestamp(entry.createdAt)} · Preferred date: {formatDate(entry.preferredDate)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.status === 'waiting' ? 'bg-amber-100 text-amber-950' : 'bg-slate-200 text-slate-800'}`}>{entry.status === 'waiting' ? 'Waiting locally' : 'Cancelled locally'}</span>
                  {entry.status === 'waiting' ? <button type="button" disabled={isBusy} onClick={() => { setPendingCancel(entry.id); setPendingDelete(null); }} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">Cancel ticket</button> : <button type="button" disabled={isBusy} onClick={() => { setPendingDelete(entry.id); setPendingCancel(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Delete local copy</button>}
                </div>
              </div>
              {entry.status === 'cancelled' && entry.cancelledAt && <p className="mt-3 text-sm text-slate-600">Cancelled locally at {formatTimestamp(entry.cancelledAt)}. This did not cancel or change a clinic appointment.</p>}
              {pendingCancel === entry.id && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4" role="group" aria-label="Confirm local ticket cancellation">
                  <p className="text-sm text-red-950">This marks only this local ticket as cancelled. It does not contact a clinic or change a booked appointment.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void cancelTicket(entry.id)} disabled={isBusy} className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">Confirm cancellation</button>
                    <button type="button" onClick={() => setPendingCancel(null)} disabled={isBusy} className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Keep waiting</button>
                  </div>
                </div>
              )}
              {pendingDelete === entry.id && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4" role="group" aria-label="Confirm local ticket deletion">
                  <p className="text-sm text-red-950">Delete this cancelled ticket permanently from this device? It cannot be restored from this prototype.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void deleteCancelledTicket(entry.id)} disabled={isBusy} className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">Delete permanently</button>
                    <button type="button" onClick={() => setPendingDelete(null)} disabled={isBusy} className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Keep cancelled ticket</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>

        <footer className="border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
          <p>Tickets and drafts stay in this browser profile. Cancelled tickets are purged after 90 days when the app next opens. Clearing browser site data removes everything. There is no clinic integration, identity check, notification, backup, access control, encryption or sync. Do not store real patient information here.</p>
        </footer>
      </div>
    </main>
  );
}
