import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const addon = path.join(process.cwd(), 'addon');
const props = new Map();
const events = new Map();
let nextId = 1;
let calendarList = [
  { id: 'me@example.com', summary: 'Me', primary: true, accessRole: 'owner' },
  { id: 'team@example.com', summary: 'Team', accessRole: 'owner' },
  { id: 'holidays@example.com', summary: 'Holidays', accessRole: 'reader' },
];
const calls = [];

const notFound = () => new Error('API call to calendar.events.get failed with error: Not Found');
const Calendar = {
  CalendarList: {
    get(id) {
      assert.equal(id, 'primary');
      return calendarList.find((entry) => entry.primary);
    },
    list(options) {
      assert.equal(options.minAccessRole, 'owner');
      // Two pages, to prove pagination is followed.
      return options.pageToken
        ? { items: calendarList.slice(2) }
        : { items: calendarList.slice(0, 2), nextPageToken: 'p2' };
    },
  },
  Events: {
    insert(resource, calendarId) {
      const id = `evt${nextId++}`;
      const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));
      const event = { ...resource, start: strip(resource.start), end: strip(resource.end), id, iCalUID: `${id}@google.com`, status: 'confirmed', calendarId };
      events.set(id, event);
      calls.push(['insert', calendarId]);
      return event;
    },
    get(calendarId, id) {
      const event = events.get(id);
      if (!event) throw notFound();
      return event;
    },
    patch(resource, calendarId, id) {
      const event = events.get(id);
      assert.ok(event, 'patch target must exist');
      for (const [key, value] of Object.entries(resource)) {
        if (value && typeof value === 'object') {
          event[key] = Object.fromEntries(Object.entries({ ...event[key], ...value }).filter(([, v]) => v !== null));
        } else event[key] = value;
      }
      calls.push(['patch', id]);
    },
    remove(calendarId, id) {
      assert.ok(events.delete(id), 'remove target must exist');
      calls.push(['remove', id]);
    },
  },
};

const context = vm.createContext({
  console,
  Date,
  Calendar,
  PropertiesService: {
    getDocumentProperties() {
      return { getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, String(v)) };
    },
  },
});
for (const file of ['Settings.js', 'CalendarClient.js']) {
  vm.runInContext(fs.readFileSync(path.join(addon, file), 'utf8'), context, { filename: file });
}

// Calendar listing: owned only, primary first, all pages followed.
assert.deepEqual(
  JSON.parse(JSON.stringify(context.rowspringListCalendars())),
  [
    { id: 'me@example.com', name: 'Me', isDefault: true },
    { id: 'team@example.com', name: 'Team', isDefault: false },
  ],
);
assert.equal(context.rowspringResolveCalendarId(), 'me@example.com');
props.set('ROWSPRING_CALENDAR_ID', 'team@example.com');
assert.equal(context.rowspringResolveCalendarId(), 'team@example.com');
props.set('ROWSPRING_CALENDAR_ID', 'gone@example.com');
assert.throws(() => context.rowspringResolveCalendarId(), /no longer available/);
props.set('ROWSPRING_CALENDAR_ID', 'team@example.com');

// Create timed + all-day; stored IDs keep the iCalUID format.
const timedId = context.rowspringCreateEvent({
  title: 'Timed', start: new Date('2026-10-15T19:00:00Z'), end: new Date('2026-10-15T19:30:00Z'),
});
const allDayId = context.rowspringCreateEvent({ title: 'All day', allDay: true, date: '2026-10-31' });
assert.match(timedId, /^evt\d+@google\.com$/);
assert.deepEqual(JSON.parse(JSON.stringify(events.get('evt2').end)), { date: '2026-11-01' }, 'all-day end is exclusive and rolls over months');
assert.equal(context.rowspringNextDate('2026-12-31'), '2027-01-01');

// Read back in planner shape.
let existing = context.rowspringGetExistingEvents([timedId, allDayId, 'nope@google.com']);
assert.equal(existing.length, 2);
assert.equal(existing[0].start.toISOString(), '2026-10-15T19:00:00.000Z');
assert.equal(existing[1].allDay, true);
assert.equal(existing[1].date, '2026-10-31');

// Update timed, and convert timed -> all-day.
context.rowspringUpdateEvent({
  eventId: timedId, title: 'Timed v2', start: new Date('2026-10-15T20:00:00Z'), end: new Date('2026-10-15T20:30:00Z'),
});
assert.equal(events.get('evt1').summary, 'Timed v2');
context.rowspringUpdateEvent({ eventId: timedId, title: 'Now all day', allDay: true, date: '2026-10-16' });
assert.deepEqual(JSON.parse(JSON.stringify(events.get('evt1').start)), { date: '2026-10-16' });
assert.throws(() => context.rowspringUpdateEvent({ eventId: 'nope@google.com', title: 'x', allDay: true, date: '2026-10-16' }), /Event not found/);

// A user-deleted (cancelled) event counts as missing; delete is then a no-op.
events.get('evt2').status = 'cancelled';
assert.equal(context.rowspringGetExistingEvents([allDayId]).length, 0);
const before = calls.length;
context.rowspringDeleteEvent(allDayId);
assert.equal(calls.length, before, 'cancelled event must not be removed again');

// Real delete, and non-404 errors propagate.
context.rowspringDeleteEvent(timedId);
assert.equal(events.has('evt1'), false);
Calendar.Events.get = () => { throw new Error('Quota exceeded'); };
assert.throws(() => context.rowspringGetExistingEvents(['a@google.com']), /Quota/);

console.log('Calendar client contract: ok');
