/**
 * Smoke test only — confirms clasp push -> real Apps Script -> real Sheet
 * works end to end. Will be replaced by the real add-on entry points
 * (onOpen menu, sidebar, CalendarClient) once this round-trip is proven.
 */
function pingRowspring() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  sheet.toast('Rowspring dev push reached this sheet.', 'Rowspring', 5);
  Logger.log('pingRowspring ran at ' + new Date().toISOString());
  return 'ok';
}

/**
 * Real-Calendar smoke test for rowspringCreateEvent / rowspringUpdateEvent /
 * rowspringDeleteEvent. Creates a timed event and an all-day event, renames
 * the timed one, deletes the all-day one, and logs everything so it can be
 * checked against src/core/planner.ts's own test expectations by hand.
 *
 * After running: the renamed timed event should exist tomorrow 10:00-10:30,
 * and the all-day event should be GONE from the calendar (deleted).
 */
function testRealCalendarClient() {
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var timedStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0);
  var timedEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 30);

  var dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  var allDayDateStr = Utilities.formatDate(dayAfter, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var timedEventId = rowspringCreateEvent({
    type: 'create',
    title: 'Rowspring smoke test (timed)',
    start: timedStart,
    end: timedEnd,
  });
  Logger.log('Created timed event: ' + timedEventId);

  var allDayEventId = rowspringCreateEvent({
    type: 'create',
    title: 'Rowspring smoke test (all-day)',
    allDay: true,
    date: allDayDateStr,
  });
  Logger.log('Created all-day event: ' + allDayEventId);

  rowspringUpdateEvent({
    type: 'update',
    eventId: timedEventId,
    title: 'Rowspring smoke test (timed, renamed)',
    start: timedStart,
    end: timedEnd,
  });
  Logger.log('Renamed timed event ' + timedEventId);

  rowspringDeleteEvent(allDayEventId);
  Logger.log('Deleted all-day event ' + allDayEventId);

  Logger.log(
    'DONE. Check your Google Calendar: tomorrow 10:00-10:30 should show ' +
      '"Rowspring smoke test (timed, renamed)". The all-day event ' +
      'two days out should NOT be there (it was deleted).',
  );
}

var ROWSPRING_SHEET_NAME = 'Events';
var ROWSPRING_LOG_SHEET_NAME = 'Log';
var ROWSPRING_COLUMN_MAPPING = {
  eventId: 'Event ID',
  title: 'Title',
  start: 'Start',
  end: 'End',
  allDay: 'All Day',
  status: 'Status',
};

function rowspringGetOrCreateLogSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(ROWSPRING_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(ROWSPRING_LOG_SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Action', 'Row', 'Event ID', 'Result', 'Detail']);
  }
  return sheet;
}

/**
 * The real end-to-end sync: reads the Events sheet, plans against the
 * bundled, unit-tested core logic (Rowspring.*), applies the plan through
 * the real CalendarClient, then writes the results and a log entry back
 * into the sheet. Every decision here was already proven in
 * src/core/*.test.ts — this function's only job is wiring real I/O to
 * that tested logic.
 */
function syncNow() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(ROWSPRING_SHEET_NAME);
  if (!sheet) {
    throw new Error('No sheet named "' + ROWSPRING_SHEET_NAME + '" found.');
  }

  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var dataRows = values.slice(1);

  var rows = Rowspring.readSheetRows(header, dataRows, ROWSPRING_COLUMN_MAPPING, 2);

  var linkedEventIds = rows.map(function (r) { return r.eventId; }).filter(function (id) { return id !== null; });
  var existingEvents = rowspringGetExistingEvents(linkedEventIds);

  var plan = Rowspring.planSync(rows, existingEvents);

  var client = {
    createEvent: rowspringCreateEvent,
    updateEvent: rowspringUpdateEvent,
    deleteEvent: rowspringDeleteEvent,
  };
  var result = Rowspring.applyPlan(plan, client);

  var writeback = Rowspring.buildWriteback(plan, result, function () { return new Date(); });

  var eventIdCol = header.indexOf(ROWSPRING_COLUMN_MAPPING.eventId) + 1;
  writeback.eventIdWrites.forEach(function (write) {
    sheet.getRange(write.rowIndex, eventIdCol).setValue(write.eventId);
  });

  var logSheet = rowspringGetOrCreateLogSheet(spreadsheet);
  writeback.logRows.forEach(function (log) {
    logSheet.appendRow([log.timestamp, log.action, log.rowIndex, log.eventId, log.result, log.detail]);
  });

  var summary =
    plan.actions.length +
    ' action(s) planned. ' +
    result.createdEventIds.length +
    ' created, ' +
    result.errors.length +
    ' error(s). See the Log tab for details.';
  Logger.log(summary);
  spreadsheet.toast(summary, 'Rowspring sync', 8);
}
