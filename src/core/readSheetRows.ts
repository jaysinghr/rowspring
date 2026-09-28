import type { SheetRow } from './planner';

export interface ColumnMapping {
  eventId: string;
  title: string;
  start: string;
  end: string;
  allDay: string;
  status: string;
}

/**
 * Turns raw Sheets cell values (as read by SpreadsheetApp.getDataRange)
 * into the SheetRow shape the planner expects. Contains no Google-specific
 * calls, so it is fully testable without Apps Script.
 */
export function readSheetRows(
  header: string[],
  dataRows: unknown[][],
  mapping: ColumnMapping,
  firstDataRowIndex: number,
): SheetRow[] {
  const colIndex = (columnName: string): number => header.indexOf(columnName);
  const eventIdCol = colIndex(mapping.eventId);
  const titleCol = colIndex(mapping.title);
  const startCol = colIndex(mapping.start);
  const endCol = colIndex(mapping.end);
  const allDayCol = colIndex(mapping.allDay);
  const statusCol = colIndex(mapping.status);

  return dataRows.map((cells, i) => {
    const rawEventId = cells[eventIdCol];
    const eventId = typeof rawEventId === 'string' && rawEventId.trim() !== '' ? rawEventId : null;

    const row: SheetRow = {
      rowIndex: firstDataRowIndex + i,
      eventId,
      title: String(cells[titleCol] ?? ''),
      start: cells[startCol] as Date,
      end: cells[endCol] as Date,
    };

    if (cells[allDayCol] === true) {
      row.allDay = true;
    }
    if (cells[statusCol] === 'DELETE') {
      row.status = 'DELETE';
    }

    return row;
  });
}
