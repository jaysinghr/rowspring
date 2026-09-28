export interface SheetRow {
  rowIndex: number;
  eventId: string | null;
  title: string;
  start: Date;
  end: Date;
  status?: 'DELETE';
}

export interface ExistingEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
}

export interface CreateAction {
  type: 'create';
  rowIndex: number;
  title: string;
  start: Date;
  end: Date;
}

export interface UpdateAction {
  type: 'update';
  rowIndex: number;
  eventId: string;
  title: string;
  start: Date;
  end: Date;
}

export interface DeleteAction {
  type: 'delete';
  rowIndex: number;
  eventId: string;
}

export type SyncAction = CreateAction | UpdateAction | DeleteAction;

export interface SyncPlan {
  actions: SyncAction[];
}

function fieldsMatch(row: SheetRow, event: ExistingEvent): boolean {
  return (
    row.title === event.title &&
    row.start.getTime() === event.start.getTime() &&
    row.end.getTime() === event.end.getTime()
  );
}

export function planSync(rows: SheetRow[], existingEvents: ExistingEvent[]): SyncPlan {
  const eventsById = new Map(existingEvents.map((event) => [event.id, event]));
  const actions: SyncAction[] = [];

  for (const row of rows) {
    if (row.status === 'DELETE') {
      if (row.eventId !== null) {
        actions.push({ type: 'delete', rowIndex: row.rowIndex, eventId: row.eventId });
      }
      continue;
    }

    if (row.eventId === null) {
      actions.push({
        type: 'create',
        rowIndex: row.rowIndex,
        title: row.title,
        start: row.start,
        end: row.end,
      });
      continue;
    }

    const linkedEvent = eventsById.get(row.eventId);
    if (linkedEvent && fieldsMatch(row, linkedEvent)) {
      continue;
    }

    if (linkedEvent) {
      actions.push({
        type: 'update',
        rowIndex: row.rowIndex,
        eventId: row.eventId,
        title: row.title,
        start: row.start,
        end: row.end,
      });
    }
  }

  return { actions };
}
