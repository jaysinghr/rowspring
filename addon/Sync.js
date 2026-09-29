/** Reliable manual, scheduled, and resumable synchronization orchestration. */

var ROWSPRING_ACTIONS_PER_RUN = 100;
var ROWSPRING_TIME_BUDGET_MS = 240000;

function rowspringGetOrCreateLogSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(ROWSPRING_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(ROWSPRING_LOG_SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Action', 'Row', 'Event ID', 'Result', 'Detail']);
  } else if (rowspringSheetIsBlank(sheet)) {
    sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Action', 'Row', 'Event ID', 'Result', 'Detail']]);
  }
  sheet.setFrozenRows(1);
  sheet.setTabColor('#62707d');
  sheet.getRange(1, 1, 1, 6)
    .setBackground('#17223b')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  [155, 90, 70, 230, 80, 300].forEach(function (width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
  sheet.getRange('A:A').setNumberFormat('m/d/yyyy h:mm:ss');
  return sheet;
}

function openRowspringLog() {
  var spreadsheet = rowspringGetSpreadsheet();
  rowspringGetOrCreateLogSheet(spreadsheet).activate();
}

function rowspringAppendLogRows(spreadsheet, logRows) {
  if (logRows.length === 0) return;
  var sheet = rowspringGetOrCreateLogSheet(spreadsheet);
  var values = logRows.map(function (log) {
    return [new Date(log.timestamp), log.action, log.rowIndex, log.eventId || '', log.result, log.detail];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, 6).setValues(values);
}

function rowspringAppendSystemError(spreadsheet, message) {
  rowspringAppendLogRows(spreadsheet, [{
    timestamp: new Date().toISOString(),
    action: 'sync',
    rowIndex: '',
    eventId: '',
    result: 'error',
    detail: message,
  }]);
}

function rowspringPersistLastRun(record) {
  rowspringGetProperties().setProperty(
    ROWSPRING_PROPERTY_KEYS.lastRun,
    JSON.stringify(Object.assign({ timestamp: new Date().toISOString() }, record)),
  );
}

function rowspringScheduleContinuation() {
  rowspringDeleteTriggers('rowspringContinueSync');
  ScriptApp.newTrigger('rowspringContinueSync').timeBased().after(60000).create();
}

function rowspringApplyWriteback(sheet, header, writeback) {
  var eventIdCol = header.indexOf(ROWSPRING_COLUMN_MAPPING.eventId) + 1;
  writeback.eventIdWrites.forEach(function (write) {
    sheet.getRange(write.rowIndex, eventIdCol).setValue(write.eventId);
  });

  var managedColumns = Object.keys(ROWSPRING_COLUMN_MAPPING).map(function (key) {
    return header.indexOf(ROWSPRING_COLUMN_MAPPING[key]) + 1;
  });
  writeback.deletedRowClears.forEach(function (rowIndex) {
    managedColumns.forEach(function (columnIndex) {
      sheet.getRange(rowIndex, columnIndex).clearContent();
    });
  });
}

function rowspringSuccessfulActionCount(plan, result, type) {
  var failedRows = {};
  result.errors.forEach(function (error) { failedRows[error.rowIndex] = true; });
  return plan.actions.filter(function (action) {
    return action.type === type && !failedRows[action.rowIndex];
  }).length;
}

function rowspringOutcomeSummary(outcome) {
  if (outcome.planned === 0) return 'Everything already matches. No changes were needed.';
  var summary =
    outcome.created + ' created, ' +
    outcome.updated + ' updated, ' +
    outcome.deleted + ' deleted, ' +
    outcome.errors + ' error(s).';
  if (outcome.queued > 0 && outcome.continuationScheduled) {
    summary += ' ' + outcome.queued + ' action(s) queued to continue automatically.';
  } else if (outcome.queued > 0) {
    summary += ' Run sync again for the remaining ' + outcome.queued + ' action(s).';
  }
  return summary;
}

function rowspringRunSync(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Another Rowspring sync is already running. Try again in a moment.');

  var spreadsheet = null;
  try {
    spreadsheet = rowspringGetSpreadsheet();
    var sheet = spreadsheet.getSheetByName(ROWSPRING_SHEET_NAME);
    if (!sheet) throw new Error('The Events sheet is missing. Open Rowspring and run setup.');

    var values = sheet.getDataRange().getValues();
    var header = values[0] || [];
    var rows = Rowspring.readSheetRows(header, values.slice(1), ROWSPRING_COLUMN_MAPPING, 2);
    var linkedEventIds = rows
      .map(function (row) { return row.eventId; })
      .filter(function (eventId) { return eventId !== null; });
    var existingEvents = rowspringGetExistingEvents(linkedEventIds);
    var timezone = spreadsheet.getSpreadsheetTimeZone();
    var plan = Rowspring.planSync(rows, existingEvents, function (date) {
      return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
    });

    var actionWindow = plan.actions.slice(0, ROWSPRING_ACTIONS_PER_RUN);
    var result = { createdEventIds: [], errors: [] };
    var client = {
      createEvent: rowspringCreateEvent,
      updateEvent: rowspringUpdateEvent,
      deleteEvent: rowspringDeleteEvent,
    };
    var chunk = Rowspring.runChunk({
      items: actionWindow,
      startIndex: 0,
      timeBudgetMs: ROWSPRING_TIME_BUDGET_MS,
      now: function () { return Date.now(); },
      processOne: function (action) {
        var actionResult = Rowspring.applyPlan({ actions: [action] }, client);
        result.createdEventIds = result.createdEventIds.concat(actionResult.createdEventIds);
        result.errors = result.errors.concat(actionResult.errors);
      },
    });

    var processedPlan = { actions: actionWindow.slice(0, chunk.nextIndex) };
    var writeback = Rowspring.buildWriteback(processedPlan, result, function () { return new Date(); });
    rowspringApplyWriteback(sheet, header, writeback);
    rowspringAppendLogRows(spreadsheet, writeback.logRows);
    SpreadsheetApp.flush();

    var queued = Math.max(plan.actions.length - processedPlan.actions.length, 0);
    var continuationScheduled = false;
    var continuationError = null;
    if (queued > 0) {
      try {
        rowspringScheduleContinuation();
        continuationScheduled = true;
      } catch (error) {
        continuationError = error instanceof Error ? error.message : String(error);
        rowspringAppendSystemError(spreadsheet, 'Could not schedule continuation: ' + continuationError);
      }
    } else {
      try {
        rowspringDeleteTriggers('rowspringContinueSync');
      } catch (error) {
        Logger.log('Rowspring could not remove a stale continuation trigger: ' + String(error));
      }
    }

    var outcome = {
      state: result.errors.length > 0 || continuationError ? 'warning' : 'success',
      source: options.source || 'manual',
      planned: plan.actions.length,
      processed: processedPlan.actions.length,
      queued: queued,
      continuationScheduled: continuationScheduled,
      created: rowspringSuccessfulActionCount(processedPlan, result, 'create'),
      updated: rowspringSuccessfulActionCount(processedPlan, result, 'update'),
      deleted: rowspringSuccessfulActionCount(processedPlan, result, 'delete'),
      errors: result.errors.length + (continuationError ? 1 : 0),
    };
    outcome.message = rowspringOutcomeSummary(outcome);
    rowspringPersistLastRun(outcome);

    Logger.log(outcome.message);
    if (options.showToast) spreadsheet.toast(outcome.message, 'Rowspring sync', 8);
    return outcome;
  } catch (error) {
    var message = error instanceof Error ? error.message : String(error);
    try {
      rowspringPersistLastRun({ state: 'error', source: options.source || 'manual', message: message });
      if (spreadsheet) rowspringAppendSystemError(spreadsheet, message);
    } catch (loggingError) {
      Logger.log('Rowspring could not persist the sync failure: ' + String(loggingError));
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function syncNow() {
  return rowspringRunSync({ source: 'manual', showToast: true });
}

function rowspringScheduledSync() {
  return rowspringRunSync({ source: 'schedule', showToast: false });
}

function rowspringContinueSync() {
  return rowspringRunSync({ source: 'continuation', showToast: false });
}
