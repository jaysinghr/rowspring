import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const addon = path.join(root, 'addon');
const propertyValues = new Map();
const properties = {
  getProperty(key) { return propertyValues.get(key) ?? null; },
  setProperty(key, value) { propertyValues.set(key, String(value)); return this; },
};

let triggers = [];
function triggerBuilder(handler) {
  const record = { handler, cadence: null, value: null };
  return {
    timeBased() { return this; },
    everyMinutes(value) { record.cadence = 'minutes'; record.value = value; return this; },
    everyHours(value) { record.cadence = 'hours'; record.value = value; return this; },
    after(value) { record.cadence = 'after'; record.value = value; return this; },
    create() {
      const trigger = { record, getHandlerFunction() { return handler; } };
      triggers.push(trigger);
      return trigger;
    },
  };
}

const context = vm.createContext({
  console,
  Date,
  Logger: { log() {} },
  PropertiesService: {
    getDocumentProperties() { return properties; },
    getScriptProperties() { return properties; },
  },
  ScriptApp: {
    getProjectTriggers() { return triggers; },
    deleteTrigger(trigger) { triggers = triggers.filter((candidate) => candidate !== trigger); },
    newTrigger(handler) { return triggerBuilder(handler); },
  },
});

for (const file of ['Core.generated.js', 'Settings.js', 'CalendarClient.js', 'Sync.js', 'Code.js']) {
  vm.runInContext(fs.readFileSync(path.join(addon, file), 'utf8'), context, { filename: file });
}

for (const functionName of [
  'onOpen',
  'onInstall',
  'showRowspringSidebar',
  'setupRowspring',
  'getRowspringAppState',
  'saveRowspringSettings',
  'syncNow',
  'rowspringScheduledSync',
  'rowspringContinueSync',
  'openRowspringLog',
]) {
  assert.equal(typeof context[functionName], 'function', `Missing Apps Script entry point: ${functionName}`);
}

for (const exportName of ['planSync', 'runChunk', 'applyPlan', 'readSheetRows', 'buildWriteback']) {
  assert.equal(typeof context.Rowspring[exportName], 'function', `Missing bundle export: Rowspring.${exportName}`);
}
assert.equal('Rowspring' in context.Rowspring, false, 'Bundle API must not be nested');

context.rowspringConfigureAutoSync(15);
assert.equal(triggers.length, 1);
assert.deepEqual(triggers[0].record, { handler: 'rowspringScheduledSync', cadence: 'minutes', value: 15 });
context.rowspringConfigureAutoSync(60);
assert.equal(triggers.length, 1, 'Changing schedules must replace the previous trigger');
assert.deepEqual(triggers[0].record, { handler: 'rowspringScheduledSync', cadence: 'hours', value: 1 });
context.rowspringConfigureAutoSync(0);
assert.equal(triggers.length, 0, 'Turning automatic sync off must remove its trigger');

const rangeCalls = [];
const sheet = {
  getRange(row, column) {
    return {
      setValue(value) { rangeCalls.push({ type: 'set', row, column, value }); },
      clearContent() { rangeCalls.push({ type: 'clear', row, column }); },
    };
  },
};
context.rowspringApplyWriteback(
  sheet,
  ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'],
  { eventIdWrites: [{ rowIndex: 2, eventId: 'evt-new' }], deletedRowClears: [4], logRows: [] },
);
assert.deepEqual(rangeCalls[0], { type: 'set', row: 2, column: 1, value: 'evt-new' });
assert.equal(rangeCalls.filter((call) => call.type === 'clear' && call.row === 4).length, 6);

assert.equal(
  context.rowspringOutcomeSummary({ planned: 0 }),
  'Everything already matches. No changes were needed.',
);
assert.match(
  context.rowspringOutcomeSummary({
    planned: 3,
    created: 1,
    updated: 1,
    deleted: 0,
    errors: 0,
    queued: 1,
    continuationScheduled: true,
  }),
  /1 action\(s\) queued/,
);

const eventIdWrites = [];
const eventValues = [
  ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'],
  ['', 'Runtime contract event', new Date('2026-10-05T09:00:00Z'), new Date('2026-10-05T09:30:00Z'), false, ''],
  ['', 'Queued contract event', new Date('2026-10-06T09:00:00Z'), new Date('2026-10-06T09:30:00Z'), false, ''],
];
const eventSheet = {
  getDataRange() { return { getValues() { return eventValues; } }; },
  getRange(row, column) {
    return {
      setValue(value) { eventIdWrites.push({ row, column, value }); },
      clearContent() {},
    };
  },
};
const spreadsheet = {
  getSheetByName(name) { return name === 'Events' ? eventSheet : null; },
  getSpreadsheetTimeZone() { return 'UTC'; },
  toast() {},
};
context.LockService = {
  getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; },
};
context.SpreadsheetApp = { flush() {} };
context.Utilities = { formatDate(date) { return date.toISOString().slice(0, 10); } };
context.rowspringGetSpreadsheet = () => spreadsheet;
context.rowspringGetExistingEvents = () => [];
context.rowspringCreateEvent = (action) => `created-row-${action.rowIndex}`;
context.rowspringUpdateEvent = () => {};
context.rowspringDeleteEvent = () => {};
context.rowspringAppendLogRows = () => {};
context.ROWSPRING_ACTIONS_PER_RUN = 1;

const runtimeOutcome = context.rowspringRunSync({ source: 'contract', showToast: false });
assert.equal(runtimeOutcome.created, 1);
assert.equal(runtimeOutcome.queued, 1);
assert.deepEqual(eventIdWrites[0], { row: 2, column: 1, value: 'created-row-2' });
assert.ok(
  triggers.some((trigger) => trigger.record.handler === 'rowspringContinueSync' && trigger.record.cadence === 'after'),
  'A continuation trigger must be scheduled for queued actions',
);
const persistedRun = JSON.parse(properties.getProperty('ROWSPRING_LAST_RUN'));
assert.equal(persistedRun.source, 'contract');
assert.equal(persistedRun.queued, 1);

const sidebar = fs.readFileSync(path.join(addon, 'Sidebar.html'), 'utf8');
const inlineScript = sidebar.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inlineScript, 'Sidebar inline script is missing');
new Function(inlineScript[1]);
for (const id of ['primaryButton', 'calendarSelect', 'scheduleSelect', 'saveButton', 'logButton']) {
  assert.match(sidebar, new RegExp(`id=["']${id}["']`), `Sidebar control is missing: ${id}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(addon, 'appsscript.json'), 'utf8'));
for (const scope of [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.container.ui',
  'https://www.googleapis.com/auth/script.scriptapp',
]) {
  assert.ok(manifest.oauthScopes.includes(scope), `Manifest scope is missing: ${scope}`);
}

console.log('Apps Script runtime contract: ok');
