/** Document configuration, sheet setup, calendar selection, and schedules. */

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
var ROWSPRING_REQUIRED_HEADERS = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];
var ROWSPRING_PROPERTY_KEYS = {
  spreadsheetId: 'ROWSPRING_SPREADSHEET_ID',
  calendarId: 'ROWSPRING_CALENDAR_ID',
  autoSyncMinutes: 'ROWSPRING_AUTO_SYNC_MINUTES',
  lastRun: 'ROWSPRING_LAST_RUN',
};
var ROWSPRING_ALLOWED_SYNC_MINUTES = [0, 15, 30, 60];

function rowspringGetProperties() {
  return PropertiesService.getDocumentProperties() || PropertiesService.getScriptProperties();
}

function rowspringRememberSpreadsheet(spreadsheet) {
  rowspringGetProperties().setProperty(ROWSPRING_PROPERTY_KEYS.spreadsheetId, spreadsheet.getId());
}

function rowspringGetSpreadsheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    rowspringRememberSpreadsheet(active);
    return active;
  }

  var spreadsheetId = rowspringGetProperties().getProperty(ROWSPRING_PROPERTY_KEYS.spreadsheetId);
  if (!spreadsheetId) {
    throw new Error('Rowspring has not been connected to a spreadsheet yet. Open the sidebar once and try again.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function rowspringSheetIsBlank(sheet) {
  var values = sheet.getDataRange().getValues();
  return values.every(function (row) {
    return row.every(function (value) { return value === '' || value === null; });
  });
}

function rowspringApplyEventsSheetFormat(sheet) {
  if (sheet.getMaxColumns() < ROWSPRING_REQUIRED_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), ROWSPRING_REQUIRED_HEADERS.length - sheet.getMaxColumns());
  }

  sheet.setFrozenRows(1);
  sheet.setTabColor('#1f9d68');
  sheet.setRowHeight(1, 34);
  var header = sheet.getDataRange().getValues()[0] || [];
  var widths = [210, 260, 155, 155, 90, 105];
  ROWSPRING_REQUIRED_HEADERS.forEach(function (name, index) {
    var column = header.indexOf(name) + 1;
    sheet.getRange(1, column)
      .setBackground('#17223b')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('left');
    sheet.setColumnWidth(column, widths[index]);
  });

  var dataRowCount = Math.max(sheet.getMaxRows() - 1, 1);
  var startColumn = header.indexOf(ROWSPRING_COLUMN_MAPPING.start) + 1;
  var endColumn = header.indexOf(ROWSPRING_COLUMN_MAPPING.end) + 1;
  var allDayColumn = header.indexOf(ROWSPRING_COLUMN_MAPPING.allDay) + 1;
  var statusColumn = header.indexOf(ROWSPRING_COLUMN_MAPPING.status) + 1;
  sheet.getRange(2, startColumn, dataRowCount, 1).setNumberFormat('m/d/yyyy h:mm');
  sheet.getRange(2, endColumn, dataRowCount, 1).setNumberFormat('m/d/yyyy h:mm');
  sheet.getRange(2, allDayColumn, dataRowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build(),
  );
  sheet.getRange(2, statusColumn, dataRowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['DELETE'], true)
      .setAllowInvalid(false)
      .setHelpText('Leave blank to sync, or choose DELETE to remove the linked calendar event.')
      .build(),
  );
}

function setupRowspring() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Rowspring is busy. Try setup again in a moment.');

  try {
    var spreadsheet = rowspringGetSpreadsheet();
    var sheet = spreadsheet.getSheetByName(ROWSPRING_SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(ROWSPRING_SHEET_NAME);

    if (rowspringSheetIsBlank(sheet)) {
      sheet.getRange(1, 1, 1, ROWSPRING_REQUIRED_HEADERS.length).setValues([ROWSPRING_REQUIRED_HEADERS]);
    } else {
      var header = sheet.getDataRange().getValues()[0] || [];
      Rowspring.readSheetRows(header, [], ROWSPRING_COLUMN_MAPPING, 2);
    }

    rowspringApplyEventsSheetFormat(sheet);
    rowspringGetOrCreateLogSheet(spreadsheet);
    sheet.activate();
    spreadsheet.toast('Events and Log sheets are ready.', 'Rowspring setup', 6);
    return getRowspringAppState();
  } finally {
    lock.releaseLock();
  }
}

function rowspringCountLinkedRows(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(ROWSPRING_SHEET_NAME);
  if (!sheet) return 0;
  var values = sheet.getDataRange().getValues();
  var header = values[0] || [];
  var eventIdCol = header.indexOf(ROWSPRING_COLUMN_MAPPING.eventId);
  if (eventIdCol < 0) return 0;
  return values.slice(1).filter(function (row) {
    return String(row[eventIdCol] || '').trim() !== '';
  }).length;
}

function rowspringGetConfiguredCalendarId() {
  return rowspringGetProperties().getProperty(ROWSPRING_PROPERTY_KEYS.calendarId);
}

function rowspringListOwnedCalendars() {
  var entries = [];
  var pageToken;
  do {
    var page = Calendar.CalendarList.list({ minAccessRole: 'owner', pageToken: pageToken });
    entries = entries.concat(page.items || []);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return entries.filter(function (entry) { return entry.accessRole === 'owner'; });
}

function rowspringGetPrimaryCalendarId() {
  return Calendar.CalendarList.get('primary').id;
}

/** The calendar ID events are written to; throws if the choice vanished. */
function rowspringResolveCalendarId() {
  var configuredId = rowspringGetConfiguredCalendarId();
  if (!configuredId) return rowspringGetPrimaryCalendarId();
  var found = rowspringListOwnedCalendars().some(function (entry) { return entry.id === configuredId; });
  if (!found) {
    throw new Error('The selected calendar is no longer available. Choose another calendar in Rowspring settings.');
  }
  return configuredId;
}

function rowspringListCalendars() {
  var defaultId = rowspringGetPrimaryCalendarId();
  return rowspringListOwnedCalendars()
    .map(function (entry) {
      return {
        id: entry.id,
        name: entry.summaryOverride || entry.summary || entry.id,
        isDefault: entry.id === defaultId,
      };
    })
    .sort(function (a, b) {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function rowspringDeleteTriggers(handlerFunction) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handlerFunction) ScriptApp.deleteTrigger(trigger);
  });
}

function rowspringConfigureAutoSync(minutes) {
  rowspringDeleteTriggers('rowspringScheduledSync');
  if (minutes === 15 || minutes === 30) {
    ScriptApp.newTrigger('rowspringScheduledSync').timeBased().everyMinutes(minutes).create();
  } else if (minutes === 60) {
    ScriptApp.newTrigger('rowspringScheduledSync').timeBased().everyHours(1).create();
  }
  rowspringGetProperties().setProperty(ROWSPRING_PROPERTY_KEYS.autoSyncMinutes, String(minutes));
}

function saveRowspringSettings(settings) {
  if (!settings || typeof settings.calendarId !== 'string') throw new Error('Choose a calendar.');
  var minutes = Number(settings.autoSyncMinutes);
  if (ROWSPRING_ALLOWED_SYNC_MINUTES.indexOf(minutes) < 0) {
    throw new Error('Choose a supported automatic sync interval.');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('A sync is running. Save settings again in a moment.');

  try {
    var spreadsheet = rowspringGetSpreadsheet();
    var calendars = rowspringListCalendars();
    var selected = calendars.filter(function (calendar) { return calendar.id === settings.calendarId; })[0];
    if (!selected) throw new Error('Rowspring can only sync to a calendar you own.');

    var currentId = rowspringGetConfiguredCalendarId() || rowspringGetPrimaryCalendarId();
    var currentCalendarAvailable = calendars.some(function (calendar) { return calendar.id === currentId; });
    if (settings.calendarId !== currentId && currentCalendarAvailable && rowspringCountLinkedRows(spreadsheet) > 0) {
      throw new Error('The calendar is locked while Event IDs are linked. Delete or clear those event rows before switching calendars.');
    }
    if (minutes > 0 && !rowspringBuildSheetStatus(spreadsheet).ready) {
      throw new Error('Finish setting up and fixing the Events sheet before enabling automatic sync.');
    }

    rowspringGetProperties().setProperty(ROWSPRING_PROPERTY_KEYS.calendarId, settings.calendarId);
    rowspringConfigureAutoSync(minutes);
    spreadsheet.toast('Rowspring settings saved.', 'Rowspring', 5);
    return getRowspringAppState();
  } finally {
    lock.releaseLock();
  }
}

function rowspringReadLastRun() {
  var raw = rowspringGetProperties().getProperty(ROWSPRING_PROPERTY_KEYS.lastRun);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function rowspringBuildSheetStatus(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(ROWSPRING_SHEET_NAME);
  if (!sheet) {
    return {
      ready: false,
      setupAvailable: true,
      rowCount: 0,
      linkedCount: 0,
      message: 'Set up the Events sheet to begin.',
    };
  }

  if (rowspringSheetIsBlank(sheet)) {
    return {
      ready: false,
      setupAvailable: true,
      rowCount: 0,
      linkedCount: 0,
      message: 'The Events sheet is blank. Rowspring can set it up safely.',
    };
  }

  var values = sheet.getDataRange().getValues();
  try {
    var rows = Rowspring.readSheetRows(values[0] || [], values.slice(1), ROWSPRING_COLUMN_MAPPING, 2);
    return {
      ready: true,
      setupAvailable: false,
      rowCount: rows.length,
      linkedCount: rows.filter(function (row) { return row.eventId !== null; }).length,
      message: rows.length === 0 ? 'Add an event row to begin.' : 'Ready to sync.',
    };
  } catch (error) {
    return {
      ready: false,
      setupAvailable: false,
      rowCount: 0,
      linkedCount: rowspringCountLinkedRows(spreadsheet),
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function getRowspringAppState() {
  var spreadsheet = rowspringGetSpreadsheet();
  var status = rowspringBuildSheetStatus(spreadsheet);
  var calendars = rowspringListCalendars();
  var configuredCalendarId = rowspringGetConfiguredCalendarId();
  var selectedCalendarId = configuredCalendarId || rowspringGetPrimaryCalendarId();
  var selectedCalendar = calendars.filter(function (calendar) { return calendar.id === selectedCalendarId; })[0];
  var autoSyncMinutes = Number(rowspringGetProperties().getProperty(ROWSPRING_PROPERTY_KEYS.autoSyncMinutes) || '0');

  return {
    spreadsheetName: spreadsheet.getName(),
    timezone: spreadsheet.getSpreadsheetTimeZone(),
    ready: status.ready && Boolean(selectedCalendar),
    setupAvailable: status.setupAvailable,
    rowCount: status.rowCount,
    linkedCount: status.linkedCount,
    message: selectedCalendar ? status.message : 'The selected calendar is unavailable. Choose an owned calendar in Settings.',
    calendars: calendars,
    selectedCalendarId: selectedCalendarId,
    selectedCalendarName: selectedCalendar ? selectedCalendar.name : 'Unavailable calendar',
    calendarUnavailable: !selectedCalendar,
    calendarLocked: status.linkedCount > 0 && Boolean(selectedCalendar),
    autoSyncMinutes: autoSyncMinutes,
    lastRun: rowspringReadLastRun(),
  };
}

function getRowspringStatus() {
  return getRowspringAppState();
}
