# Active task

**ID:** WAITLIST-001  
**Title:** Build a queue entry with timestamp, status and safe cancellation.

## Context

The technical shell exists; the product workflow does not. Build the first safe, end-to-end domain slice for Clinic Waitlist.

## Acceptance criteria

- Type the appointments domain record, validation rules and lifecycle.
- Add a create/review flow that works without a server round-trip.
- Persist a draft with Dexie and show saved, unsaved and sync state truthfully.
- Test valid/invalid input, date/order boundaries and serialization.
- Document retention, deletion and limitations of the offline slice.
- Respect this guardrail: Keep health data out of the queue; confirm clinic flow and patient consent before notifications.

## Status

Not started. Use queue/001-waitlist. After acceptance passes, update progress and set the next task.
