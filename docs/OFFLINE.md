# Offline behavior

The public shell is cached after the first visit; API responses and personalized records are not cached by the service worker. WAITLIST-001/002 store pseudonymous tickets and one draft in Dexie in this browser profile only. There is no server write, upload, clinic integration or sync.

Tickets contain a random local code, creation time, optional preferred date, consent attestation and status timestamps. A waiting ticket remains until cancelled. Cancelled tickets may be deleted immediately and are otherwise purged after 90 days when the app next opens. The one active draft remains until saved or discarded. Clearing browser site data removes all local data. There is no export, backup, encryption, conflict handling or recovery. Do not use real patient data in this prototype.
