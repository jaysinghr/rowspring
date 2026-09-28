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
});
