# Active task

**ID:** WAITLIST-003
**Title:** Add PostgreSQL migrations and repository tests.

## Context

The first queue slice is a pseudonymous browser-local prototype. Define server persistence without implying clinic integration, identity verification or notification consent.

## Acceptance criteria

- Add a versioned PostgreSQL schema for local ticket fields and cancellation state.
- Add repository operations and integration tests against a disposable database.
- Preserve the non-clinical, minimal-data scope and keep external notifications out of this task.
- Document migration, backup, deletion and test-database handling.

## Status

Not started. Use `queue/waitlist-003-postgres-repository` after WAITLIST-001/002 is reviewed and merged.

## Completed on the day-1 branch

- WAITLIST-001 — Build a queue entry with timestamp, status and safe cancellation.
- WAITLIST-002 — Validate appointments and add empty, error and deletion states.

Evidence: `docs/days/day-001.md`. Both tasks are complete locally, pending PR review and merge.
