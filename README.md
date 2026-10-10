# Rowspring

Rowspring turns rows in a Google Sheet into events on a selected Google Calendar. The sheet is the source of truth: new rows create events, edits update linked events, and `DELETE` removes an event and clears the managed row cells.

## User workflow

Open the spreadsheet and use **Rowspring → Open sidebar**.

- **Set up Rowspring** creates and formats the `Events` and `Log` sheets when needed.
- **Sync calendar** compares every valid row with Calendar and applies only necessary changes.
- **Settings** selects an owned calendar and optionally enables hourly sync.
- **Open log** shows the per-action audit trail.

The Events sheet uses these exact columns:

| Column | Purpose |
| --- | --- |
| Event ID | Written by Rowspring after creation; do not edit manually. |
| Title | Calendar event title. |
| Start | Start date/time, or the date for an all-day event. |
| End | End date/time; optional for all-day events. |
| All Day | Checkbox. |
| Status | Leave blank, or choose `DELETE`. |

## Synchronization behavior

- Rows without Event IDs create events.
- Linked rows update only when title, time, or all-day date changed.
- A stale Event ID whose calendar event was removed externally is recreated and replaced.
- Successful deletes clear only the six Rowspring-managed cells, preserving formatting and validation.
- Invalid headers, duplicate Event IDs, blank titles, invalid dates, and backwards timed events stop the sync before Calendar is changed.
- A script lock prevents overlapping manual, scheduled, or continuation runs.
- Each run processes at most 100 actions within a four-minute budget. Remaining work receives a one-time continuation trigger.
- Calendar choice is locked while Event IDs exist, preventing silent duplication across calendars.
- All-day dates are formatted in the spreadsheet timezone and compared in the calendar timezone.

## Project structure

- `src/core/` — platform-independent planning, parsing, execution, chunking, and writeback logic.
- `src/bundle.ts` — exports the tested core as the Apps Script `Rowspring` global.
- `addon/Code.js` — spreadsheet menu and sidebar entry points.
- `addon/Settings.js` — setup, calendar settings, document state, and scheduled triggers.
- `addon/Sync.js` — locked, resumable sync orchestration and audit logging.
- `addon/CalendarClient.js` — Google Calendar adapter.
- `addon/Sidebar.html` — complete in-sheet interface.
- `scripts/verify-addon.mjs` — generated-bundle and Apps Script runtime contract checks.
- `test/` — core behavior tests.

## Development

```bash
npm install
npm run check
npm run push
```

`npm run check` runs the unit suite, TypeScript validation, bundle generation, sidebar/manifest checks, trigger checks, and a mocked end-to-end Apps Script sync. `npm run push` refuses to upload unless that full check passes.

The development Apps Script project is bound through `addon/.clasp.json`, which is intentionally ignored by Git.

## Acceptance testing

After implementation is deployed, run the consolidated checklist in [docs/ACCEPTANCE_TEST.md](docs/ACCEPTANCE_TEST.md).
