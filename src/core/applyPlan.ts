import type {
  AllDayCreateAction,
  AllDayUpdateAction,
  SyncPlan,
  TimedCreateAction,
  TimedUpdateAction,
} from './planner';

/**
 * The real implementation of this interface lives in the Apps Script layer
 * and wraps Google's Calendar Advanced Service. It is not unit-testable
 * locally: it can only be exercised by deploying to a real Google account.
 */
export interface CalendarClient {
  createEvent(action: TimedCreateAction | AllDayCreateAction): string;
  updateEvent(action: TimedUpdateAction | AllDayUpdateAction): void;
  deleteEvent(eventId: string): void;
}

export interface ApplyPlanResult {
  createdEventIds: { rowIndex: number; eventId: string }[];
  errors: { rowIndex: number; message: string }[];
}

export function applyPlan(plan: SyncPlan, client: CalendarClient): ApplyPlanResult {
  const createdEventIds: ApplyPlanResult['createdEventIds'] = [];
  const errors: ApplyPlanResult['errors'] = [];

  for (const action of plan.actions) {
    try {
      if (action.type === 'create') {
        const eventId = client.createEvent(action);
        createdEventIds.push({ rowIndex: action.rowIndex, eventId });
      } else if (action.type === 'update') {
        client.updateEvent(action);
      } else if (action.type === 'delete') {
        client.deleteEvent(action.eventId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ rowIndex: action.rowIndex, message });
    }
  }

  return { createdEventIds, errors };
}
