import { describe, expect, test } from 'vitest';
import { planSync } from '../src/core/planner';

describe('planSync', () => {
  test('creates an event for a row with no existing event id', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: null,
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ];

    const plan = planSync(rows, []);

    expect(plan.actions).toEqual([
      {
        type: 'create',
        rowIndex: 2,
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ]);
  });

  test('does nothing for a row whose linked event already matches', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ];
    const existingEvents = [
      {
        id: 'evt-1',
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ];

    const plan = planSync(rows, existingEvents);

    expect(plan.actions).toEqual([]);
  });

  test('recreates an event when its stored id no longer exists in Calendar', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: 'stale-event-id',
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ];

    const plan = planSync(rows, []);

    expect(plan.actions).toEqual([
      {
        type: 'create',
        rowIndex: 2,
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ]);
  });

  test('updates the linked event when a row field has changed', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Team standup (renamed)',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ];
    const existingEvents = [
      {
        id: 'evt-1',
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ];

    const plan = planSync(rows, existingEvents);

    expect(plan.actions).toEqual([
      {
        type: 'update',
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Team standup (renamed)',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ]);
  });

  test('deletes the linked event when the row status is DELETE', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
        status: 'DELETE' as const,
      },
    ];
    const existingEvents = [
      {
        id: 'evt-1',
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
    ];

    const plan = planSync(rows, existingEvents);

    expect(plan.actions).toEqual([
      { type: 'delete', rowIndex: 2, eventId: 'evt-1' },
    ]);
  });

  test('creates an all-day event using a plain date, not a timestamp', () => {
    // All-day events must never carry a time-of-day. A midnight timestamp
    // shifts by a day once it crosses a timezone boundary (the #4 complaint
    // in the marketplace review scan: "01/01/20 comes with 31/12/19 date").
    const rows = [
      {
        rowIndex: 2,
        eventId: null,
        title: 'Company holiday',
        allDay: true as const,
        start: new Date('2026-12-25T00:00:00Z'),
        end: new Date('2026-12-25T00:00:00Z'),
      },
    ];

    const plan = planSync(rows, []);

    expect(plan.actions).toEqual([
      {
        type: 'create',
        rowIndex: 2,
        title: 'Company holiday',
        allDay: true,
        date: '2026-12-25',
      },
    ]);
  });

  test('uses the supplied spreadsheet-timezone formatter for all-day dates', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: null,
        title: 'India holiday',
        allDay: true as const,
        // Midnight in Asia/Kolkata is still the previous UTC date.
        start: new Date('2026-12-24T18:30:00Z'),
        end: new Date('2026-12-24T18:30:00Z'),
      },
    ];

    const plan = planSync(rows, [], () => '2026-12-25');

    expect(plan.actions).toEqual([
      {
        type: 'create',
        rowIndex: 2,
        title: 'India holiday',
        allDay: true,
        date: '2026-12-25',
      },
    ]);
  });

  test('updates a linked all-day event using a plain date, not a timestamp', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Company holiday (renamed)',
        allDay: true as const,
        start: new Date('2026-12-25T00:00:00Z'),
        end: new Date('2026-12-25T00:00:00Z'),
      },
    ];
    const existingEvents = [
      {
        id: 'evt-1',
        title: 'Company holiday',
        allDay: true as const,
        date: '2026-12-25',
        start: new Date('2026-12-25T00:00:00Z'),
        end: new Date('2026-12-25T00:00:00Z'),
      },
    ];

    const plan = planSync(rows, existingEvents);

    expect(plan.actions).toEqual([
      {
        type: 'update',
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Company holiday (renamed)',
        allDay: true,
        date: '2026-12-25',
      },
    ]);
  });

  test('leaves an unchanged all-day event alone (no spurious timestamp mismatch)', () => {
    const rows = [
      {
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Company holiday',
        allDay: true as const,
        start: new Date('2026-12-25T00:00:00Z'),
        end: new Date('2026-12-25T00:00:00Z'),
      },
    ];
    const existingEvents = [
      {
        id: 'evt-1',
        title: 'Company holiday',
        allDay: true as const,
        date: '2026-12-25',
        start: new Date('2026-12-25T00:00:00Z'),
        end: new Date('2026-12-25T00:00:00Z'),
      },
    ];

    const plan = planSync(rows, existingEvents);

    expect(plan.actions).toEqual([]);
  });
});
