/**
 * Real implementation of the CalendarClient interface defined in
 * src/core/applyPlan.ts. This file is Apps Script (not TypeScript) because
 * it calls CalendarApp, which only exists inside the Apps Script runtime —
 * it cannot be unit tested locally. Every decision about WHAT to create,
 * update or delete already happened in the tested core/ logic; this file's
 * only job is to carry those decisions out against the real Calendar API.
 */

/**
 * Parses a "YYYY-MM-DD" string into a Date representing local midnight on
 * that day. Deliberately NOT `new Date(dateStr)`: that parses as UTC
 * midnight, which shifts to the previous day once rendered in any timezone
 * behind UTC — this is the #1 bug found across competitor reviews
 * ("01/01/20 comes with 31/12/19 date"). Constructing from y/m/d numbers
 * avoids that shift entirely.
 */
function rowspringDateStringToLocalDate(dateStr) {
  var parts = dateStr.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function rowspringGetCalendar() {
  return rowspringGetSelectedCalendar();
}

function rowspringCreateEvent(action) {
  var calendar = rowspringGetCalendar();
  var event = action.allDay
    ? calendar.createAllDayEvent(action.title, rowspringDateStringToLocalDate(action.date))
    : calendar.createEvent(action.title, action.start, action.end);
  return event.getId();
}

function rowspringUpdateEvent(action) {
  var calendar = rowspringGetCalendar();
  var event = calendar.getEventById(action.eventId);
  if (!event) {
    throw new Error('Event not found: ' + action.eventId);
  }
  event.setTitle(action.title);
  if (action.allDay) {
    event.setAllDayDate(rowspringDateStringToLocalDate(action.date));
  } else {
    event.setTime(action.start, action.end);
  }
}

function rowspringDeleteEvent(eventId) {
  var calendar = rowspringGetCalendar();
  var event = calendar.getEventById(eventId);
  if (event) {
    event.deleteEvent();
  }
}

/**
 * Looks up each event id and returns it in the ExistingEvent shape
 * src/core/planner.ts expects. Ids that no longer resolve to a real event
 * (deleted by the user directly in Calendar) are silently skipped — the
 * planner then treats that row as needing a fresh create, which is the
 * safe default.
 */
function rowspringGetExistingEvents(eventIds) {
  var calendar = rowspringGetCalendar();
  var events = [];
  eventIds.forEach(function (eventId) {
    var event = calendar.getEventById(eventId);
    if (!event) return;
    if (event.isAllDayEvent()) {
      events.push({
        id: eventId,
        title: event.getTitle(),
        allDay: true,
        date: Utilities.formatDate(event.getAllDayStartDate(), calendar.getTimeZone(), 'yyyy-MM-dd'),
        start: event.getAllDayStartDate(),
        end: event.getAllDayEndDate(),
      });
    } else {
      events.push({
        id: eventId,
        title: event.getTitle(),
        start: event.getStartTime(),
        end: event.getEndTime(),
      });
    }
  });
  return events;
}
