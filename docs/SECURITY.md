# Security and data policy

- Collect the minimum data; treat user content as private by default.
- No authentication, authorization, encryption-at-rest or production backup policy exists yet. Do not enter real sensitive data.
- Keep secrets in untracked .env; never expose DB/provider keys to browsers.
- Never cache APIs, authenticated pages or personal records in the service worker.
- Define export, deletion, retention, access logs and incident response before launch.
- Domain guardrail: Keep health data out of the queue; confirm clinic flow and patient consent before notifications.
- Review threat model, roles and offline-device recovery before launch.

## WAITLIST-001/002 local tickets

- Store only a random local ticket code, creation/cancellation timestamps, optional preferred date and a consent attestation. Do not enter names, contact details, health reasons or other identifiers.
- Consent is a user statement; the app cannot verify the patient or consent. The prototype sends no notifications and does not contact or change a clinic appointment.
- Tickets are stored only in browser-local IndexedDB and are not encrypted, backed up, access-controlled or synchronized. Cancelled tickets are retained for up to 90 days unless deleted sooner. This state is not a tamper-resistant audit log.
- Do not use this prototype for real patient information or clinic operations.
