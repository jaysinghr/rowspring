import { describe, expect, test } from 'vitest';
import { buildWriteback } from '../src/core/buildWriteback';
import type { SyncPlan } from '../src/core/planner';
import type { ApplyPlanResult } from '../src/core/applyPlan';

describe('buildWriteback', () => {
  test('writes the new event id and an ok log entry for a successful create', () => {
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
    const result: ApplyPlanResult = {
      createdEventIds: [{ rowIndex: 2, eventId: 'evt-new' }],
      errors: [],
    };

    const writeback = buildWriteback(plan, result, () => new Date('2026-09-28T12:00:00Z'));

    expect(writeback.eventIdWrites).toEqual([{ rowIndex: 2, eventId: 'evt-new' }]);
    expect(writeback.logRows).toEqual([
      {
        timestamp: '2026-09-28T12:00:00.000Z',
        action: 'create',
        rowIndex: 2,
        eventId: 'evt-new',
        result: 'ok',
        detail: 'Team standup',
      },
    ]);
  });

  test('does not rewrite the event id for a successful update', () => {
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
      ],
    };
    const result: ApplyPlanResult = { createdEventIds: [], errors: [] };

    const writeback = buildWriteback(plan, result, () => new Date('2026-09-28T12:00:00Z'));

    expect(writeback.eventIdWrites).toEqual([]);
    expect(writeback.logRows).toEqual([
      {
        timestamp: '2026-09-28T12:00:00.000Z',
        action: 'update',
        rowIndex: 3,
        eventId: 'evt-1',
        result: 'ok',
        detail: 'Renamed',
      },
    ]);
  });

  test('clears the event id cell after a successful delete', () => {
    const plan: SyncPlan = {
      actions: [{ type: 'delete', rowIndex: 4, eventId: 'evt-2' }],
    };
    const result: ApplyPlanResult = { createdEventIds: [], errors: [] };

    const writeback = buildWriteback(plan, result, () => new Date('2026-09-28T12:00:00Z'));

    expect(writeback.eventIdWrites).toEqual([{ rowIndex: 4, eventId: '' }]);
    expect(writeback.logRows).toEqual([
      {
        timestamp: '2026-09-28T12:00:00.000Z',
        action: 'delete',
        rowIndex: 4,
        eventId: 'evt-2',
        result: 'ok',
        detail: '',
      },
    ]);
  });

  test('logs a failed action as an error and does not touch its event id cell', () => {
    const plan: SyncPlan = {
      actions: [{ type: 'delete', rowIndex: 5, eventId: 'evt-bad' }],
    };
    const result: ApplyPlanResult = {
      createdEventIds: [],
      errors: [{ rowIndex: 5, message: 'event not found' }],
    };

    const writeback = buildWriteback(plan, result, () => new Date('2026-09-28T12:00:00Z'));

    expect(writeback.eventIdWrites).toEqual([]);
    expect(writeback.logRows).toEqual([
      {
        timestamp: '2026-09-28T12:00:00.000Z',
        action: 'delete',
        rowIndex: 5,
        eventId: 'evt-bad',
        result: 'error',
        detail: 'event not found',
      },
    ]);
  });
});
