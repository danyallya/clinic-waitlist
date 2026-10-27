# Progress log

## 2026-10-27 — foundation

**Done:** localized Next/TypeScript/Tailwind/React Icons/PostgreSQL/Docker/PWA shell, Dexie/outbox starter, health route, metadata test, CI, product brief, task/backlog and operations/security notes.

**Not done:** product workflow, auth, domain tables, sync, release security review, provider, dependency install and lockfile.

**Next:** Build a queue entry with timestamp, status and safe cancellation.

**Delivery:** Public repository created and foundation pushed to main. The latest handoff is committed locally; push it when the cache/Docker blocker is cleared.


## Environment check — 2026-10-27

**Update:** Compose now passes PostgreSQL host, database, user and password as separate environment fields so local password characters do not break a connection URL. docker compose config --quiet passes for all 30 projects; runtime verification is pending Docker access.

Docker service com.docker.service is stopped; Start-Service cannot open it with current permissions. The npm cache registry at localhost:4873 is unavailable. Offline lockfile generation returned ETARGET for eslint-config-next@16.4.3 from the host cache. No dependency install, tests or production build ran; CI reports a warning and skips dependency installation, tests, lint and build until a lockfile is committed.

**Resolution on 2026-10-28 (Asia/Tehran):** Docker Engine was started by the user, the shared local registry responded, and PostgreSQL 18.6 is healthy. Added `package-lock.json`; `npm ci` added 403 packages, `npm audit` found 0 vulnerabilities and `npm run verify` passed (6 tests, lint with one existing warning, production build). `docker compose build app` remains blocked because BuildKit does not support the configured `offline-dev-vault_vault` network mode. Running the built standalone server against local PostgreSQL returned `{"ok":true,"database":"ready"}`. The browser smoke check confirmed the empty state and required-consent validation; no browser console errors appeared.

## 2026-10-28 — day 1, WAITLIST-001/002

**Done:** Added a typed pseudonymous local ticket, preferred-date and consent validation, review-before-save, Dexie draft/entry persistence, local waiting/cancelled lifecycle, safe cancellation confirmation, deletion of cancelled tickets, expiry cleanup and explicit empty/error states. No names, contact details or health reasons are collected; no clinic or notification is contacted.

**Verification:** Install, audit, verify, browser and Docker results are recorded in `docs/days/day-001.md`. GitHub feature-PR checks and final-HEAD self-review are pending publication.

**Limitations:** No identity or consent verification, access control, encryption, backup, remote sync, clinic connection, appointment booking or notification delivery. A ticket code is not an identity or authorization token.

**Next:** WAITLIST-003 — add PostgreSQL migrations and repository tests with a disposable database.
