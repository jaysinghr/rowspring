# Rowspring acceptance test

Run this once after the complete build is deployed. Use disposable test events and an owned test calendar where possible.

## 1. Authorization and setup

1. Refresh the spreadsheet.
2. Open **Rowspring → Open sidebar** and approve requested permissions if Google prompts.
3. If setup is offered, click **Set up Rowspring**.
4. Confirm `Events` and `Log` sheets exist, the header is frozen and styled, All Day cells are checkboxes, and Status offers `DELETE`.

## 2. Settings

1. Open Settings in the sidebar.
2. Select the desired owned calendar.
3. Leave Automatic sync **Off** initially and save.
4. Confirm the chosen calendar name appears on the sync rail.

## 3. Create and idempotency

Add two rows with blank Event ID and Status:

| Title | Start | End | All Day |
| --- | --- | --- | --- |
| Acceptance timed event | A future date at 2:00 PM | Same date at 2:30 PM | Unchecked |
| Acceptance all-day event | A different future date | Blank | Checked |

Click **Sync calendar** and confirm:

- Two events appear on the selected calendar.
- Both Event ID cells fill in.
- The sidebar reports two creations and no errors.
- The Log sheet contains two successful create entries.

Sync again without editing. Confirm it reports no changes and creates no duplicates.

## 4. Update

1. Rename the timed event and move it one hour later in the sheet.
2. Sync.
3. Confirm the existing calendar event changed rather than being duplicated.
4. Confirm the Event ID stayed the same and Log contains a successful update.

## 5. Delete

1. Choose `DELETE` in the all-day row's Status cell.
2. Sync.
3. Confirm the calendar event is gone.
4. Confirm the six managed cells in that row are blank while the checkbox/dropdown formatting remains.
5. Sync again and confirm the deleted event is not recreated.

## 6. External deletion recovery

1. Delete the timed event directly in Google Calendar.
2. Sync Rowspring.
3. Confirm Rowspring recreates it and writes a different Event ID into the same row.

## 7. Validation safety

1. Add a row whose End is before Start.
2. Confirm the sidebar disables sync and identifies the row problem.
3. Correct the End value and confirm sync becomes available again after reopening or refreshing the sidebar.
4. Duplicate an existing Event ID into another row and confirm Rowspring reports the duplicate before changing Calendar.
5. Remove the duplicate value.

## 8. Calendar lock

With a linked Event ID present, open Settings. Confirm the calendar selector is disabled and explains that linked rows lock the calendar choice.

## 9. Automatic sync

1. Set Automatic sync to **Every 15 minutes** and save.
2. Add a new valid row without clicking Sync.
3. Allow for Google's trigger scheduling window and confirm the event is created automatically.
4. Confirm Last activity and Log update.
5. Set Automatic sync back to **Off** unless continued background sync is desired.

## 10. Final cleanup

Mark remaining acceptance-test rows `DELETE`, run one final sync, and confirm the test calendar and Events sheet are clean.
