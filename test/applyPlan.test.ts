import { describe, expect, test } from 'vitest';
import { applyPlan, type CalendarClient } from '../src/core/applyPlan';
import type { SyncPlan } from '../src/core/planner';

function fakeClient(overrides: Partial<CalendarClient> = {}): CalendarClient {
  return {
    createEvent: () => 'new-event-id',
    updateEvent: () => {},
    deleteEvent: () => {},
    ...overrides,
  };
}

describe('applyPlan', () => {
  test('creates an event and reports the new event id for its row', () => {
    const plan: SyncPlan = {
      actions: [
        {
          type: 'create',
          rowIndex: 2,
          title: 'Team standup',
          start: new Date('2026-10-01T09:00:00Z'),
          end: new Date('2026-10-01T09:30:00Z'),
        },
      ],
    };

    const result = applyPlan(plan, fakeClient({ createEvent: () => 'evt-new' }));

    expect(result.createdEventIds).toEqual([{ rowIndex: 2, eventId: 'evt-new' }]);
    expect(result.errors).toEqual([]);
  });

  test('calls updateEvent for an update action and calls deleteEvent for a delete action', () => {
    const plan: SyncPlan = {
      actions: [
        {
          type: 'update',
          rowIndex: 3,
          eventId: 'evt-1',
          title: 'Renamed',
          start: new Date('2026-10-01T09:00:00Z'),
          end: new Date('2026-10-01T09:30:00Z'),
        },
        { type: 'delete', rowIndex: 4, eventId: 'evt-2' },
      ],
    };
    const updateCalls: unknown[] = [];
    const deleteCalls: unknown[] = [];

    const result = applyPlan(
      plan,
      fakeClient({
        updateEvent: (action) => {
          updateCalls.push(action);
        },
        deleteEvent: (eventId) => {
          deleteCalls.push(eventId);
        },
      }),
    );

    expect(updateCalls).toEqual([plan.actions[0]]);
    expect(deleteCalls).toEqual(['evt-2']);
    expect(result.createdEventIds).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  test('records an error and keeps processing the rest of the plan when one action throws', () => {
    const plan: SyncPlan = {
      actions: [
        { type: 'delete', rowIndex: 4, eventId: 'evt-bad' },
        {
          type: 'create',
          rowIndex: 5,
          title: 'Still runs',
          start: new Date('2026-10-01T09:00:00Z'),
          end: new Date('2026-10-01T09:30:00Z'),
        },
      ],
    };

    const result = applyPlan(
      plan,
      fakeClient({
        deleteEvent: () => {
          throw new Error('event not found');
        },
        createEvent: () => 'evt-still-ran',
      }),
    );

    expect(result.errors).toEqual([{ rowIndex: 4, message: 'event not found' }]);
    expect(result.createdEventIds).toEqual([{ rowIndex: 5, eventId: 'evt-still-ran' }]);
  });
});
