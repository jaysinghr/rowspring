import type { SyncPlan, SyncAction } from './planner';
import type { ApplyPlanResult } from './applyPlan';

export interface LogRow {
  timestamp: string;
  action: SyncAction['type'];
  rowIndex: number;
  eventId: string | null;
  result: 'ok' | 'error';
  detail: string;
}

export interface Writeback {
  eventIdWrites: { rowIndex: number; eventId: string }[];
  deletedRowClears: number[];
  logRows: LogRow[];
}

function describeAction(action: SyncAction): string {
  return 'title' in action ? action.title : '';
}

function eventIdOf(action: SyncAction): string | null {
  if (action.type === 'create') return null;
  return action.eventId;
}

export function buildWriteback(plan: SyncPlan, result: ApplyPlanResult, now: () => Date): Writeback {
  const timestamp = now().toISOString();
  const errorsByRow = new Map(result.errors.map((e) => [e.rowIndex, e.message]));
  const createdByRow = new Map(result.createdEventIds.map((c) => [c.rowIndex, c.eventId]));

  const eventIdWrites: Writeback['eventIdWrites'] = [...result.createdEventIds];
  const deletedRowClears: number[] = [];
  const logRows: LogRow[] = plan.actions.map((action) => {
    const errorMessage = errorsByRow.get(action.rowIndex);

    if (action.type === 'delete' && errorMessage === undefined) {
      deletedRowClears.push(action.rowIndex);
    }

    if (errorMessage !== undefined) {
      return {
        timestamp,
        action: action.type,
        rowIndex: action.rowIndex,
        eventId: eventIdOf(action),
        result: 'error',
        detail: errorMessage,
      };
    }

    const createdEventId = createdByRow.get(action.rowIndex);
    return {
      timestamp,
      action: action.type,
      rowIndex: action.rowIndex,
      eventId: createdEventId ?? eventIdOf(action),
      result: 'ok',
      detail: describeAction(action),
    };
  });

  return { eventIdWrites, deletedRowClears, logRows };
}
