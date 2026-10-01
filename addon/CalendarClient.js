/**
 * Real implementation of the CalendarClient interface defined in
 * src/core/applyPlan.ts, built on the Advanced Calendar service (not
 * CalendarApp) so the add-on needs only the narrow calendar.events and
 * calendar.calendarlist.readonly scopes. Every decision about WHAT to create,
 * update or delete already happened in the tested core/ logic; this file's
 * only job is to carry those decisions out against the Calendar API.
 *
 * Event IDs stored in the sheet are iCalUIDs ("<id>@google.com"), the format
 * CalendarApp.getId() returned. The API addresses events by the bare id.
 */

var ROWSPRING_ICAL_SUFFIX = /@google\.com$/;

function rowspringApiEventId(eventId) {
  return String(eventId).replace(ROWSPRING_ICAL_SUFFIX, '');
}

/** The exclusive end date the API expects for a single all-day event. */
function rowspringNextDate(dateStr) {
  var parts = dateStr.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1)).toISOString().slice(0, 10);
}

function rowspringEventTimes(action) {
  if (action.allDay) {
    return {
      start: { date: action.date, dateTime: null },
      end: { date: rowspringNextDate(action.date), dateTime: null },
    };
  }
  return {
    start: { dateTime: action.start.toISOString(), date: null },
    end: { dateTime: action.end.toISOString(), date: null },
  };
}

/**
 * Returns the API event, or null when it is missing. Events the user deleted
 * in Calendar linger as status "cancelled" and count as missing.
 */
function rowspringFindActiveEvent(calendarId, eventId) {
  try {
    var event = Calendar.Events.get(calendarId, rowspringApiEventId(eventId));
    return event && event.status !== 'cancelled' ? event : null;
  } catch (error) {
    var message = String(error && error.message ? error.message : error);
    if (/not found|deleted|\b(404|410)\b/i.test(message)) return null;
    throw error;
  }
}

function rowspringCreateEvent(action) {
  var times = rowspringEventTimes(action);
  var created = Calendar.Events.insert(
    { summary: action.title, start: times.start, end: times.end },
    rowspringResolveCalendarId(),
  );
  return created.iCalUID || created.id + '@google.com';
}

function rowspringUpdateEvent(action) {
  var calendarId = rowspringResolveCalendarId();
  if (!rowspringFindActiveEvent(calendarId, action.eventId)) {
    throw new Error('Event not found: ' + action.eventId);
  }
  var times = rowspringEventTimes(action);
  Calendar.Events.patch(
    { summary: action.title, start: times.start, end: times.end },
    calendarId,
    rowspringApiEventId(action.eventId),
  );
}

function rowspringDeleteEvent(eventId) {
  var calendarId = rowspringResolveCalendarId();
  if (rowspringFindActiveEvent(calendarId, eventId)) {
    Calendar.Events.remove(calendarId, rowspringApiEventId(eventId));
  }
}

/**
 * Looks up each event id and returns it in the ExistingEvent shape
 * src/core/planner.ts expects. Ids that no longer resolve to a live event
 * (deleted by the user directly in Calendar) are silently skipped — the
 * planner then treats that row as needing a fresh create, which is the
 * safe default.
 */
function rowspringGetExistingEvents(eventIds) {
  var calendarId = rowspringResolveCalendarId();
  var events = [];
  eventIds.forEach(function (eventId) {
    var event = rowspringFindActiveEvent(calendarId, eventId);
    if (!event) return;
    if (event.start && event.start.date) {
      events.push({
        id: eventId,
        title: event.summary || '',
        allDay: true,
        date: event.start.date,
        start: new Date(event.start.date + 'T00:00:00Z'),
        end: new Date(event.end.date + 'T00:00:00Z'),
      });
    } else {
      events.push({
        id: eventId,
        title: event.summary || '',
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
      });
    }
  });
  return events;
}
