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
});
