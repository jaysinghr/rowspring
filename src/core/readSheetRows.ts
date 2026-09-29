import type { ActiveSheetRow, DeleteSheetRow, SheetRow } from './planner';

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

  const missingColumns = Object.values(mapping).filter((columnName) => colIndex(columnName) < 0);
  if (missingColumns.length > 0) {
    throw new Error(`Missing required column(s): ${missingColumns.join(', ')}`);
  }
  const duplicateColumns = Object.values(mapping).filter(
    (columnName) => header.filter((headerValue) => headerValue === columnName).length > 1,
  );
  if (duplicateColumns.length > 0) {
    throw new Error(`Duplicate required column(s): ${duplicateColumns.join(', ')}`);
  }

  const isBlank = (value: unknown): boolean =>
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  const isValidDate = (value: unknown): value is Date =>
    value instanceof Date && !Number.isNaN(value.getTime());

  const rows: SheetRow[] = [];
  const validationErrors: string[] = [];

  dataRows.forEach((cells, i) => {
    const rowIndex = firstDataRowIndex + i;
    const rawEventId = cells[eventIdCol];
    const rawTitle = cells[titleCol];
    const rawStart = cells[startCol];
    const rawEnd = cells[endCol];
    const rawAllDay = cells[allDayCol];
    const rawStatus = cells[statusCol];

    const hasContent =
      [rawEventId, rawTitle, rawStart, rawEnd, rawStatus].some((value) => !isBlank(value)) || rawAllDay === true;
    if (!hasContent) return;

    const eventId = isBlank(rawEventId) ? null : String(rawEventId).trim();
    const title = isBlank(rawTitle) ? '' : String(rawTitle).trim();
    const status = isBlank(rawStatus) ? '' : String(rawStatus).trim().toUpperCase();

    if (status !== '' && status !== 'DELETE') {
      validationErrors.push(`Row ${rowIndex}: Status must be blank or DELETE.`);
      return;
    }

    if (status === 'DELETE') {
      if (eventId === null) {
        validationErrors.push(`Row ${rowIndex}: DELETE requires an Event ID.`);
        return;
      }
      const deleteRow: DeleteSheetRow = { rowIndex, eventId, title, status: 'DELETE' };
      if (isValidDate(rawStart)) deleteRow.start = rawStart;
      if (isValidDate(rawEnd)) deleteRow.end = rawEnd;
      if (rawAllDay === true || String(rawAllDay).trim().toUpperCase() === 'TRUE') deleteRow.allDay = true;
      rows.push(deleteRow);
      return;
    }

    if (title === '') {
      validationErrors.push(`Row ${rowIndex}: Title is required.`);
      return;
    }
    if (!isValidDate(rawStart)) {
      validationErrors.push(`Row ${rowIndex}: Start must be a valid date.`);
      return;
    }

    const allDay = rawAllDay === true || String(rawAllDay).trim().toUpperCase() === 'TRUE';
    if (!allDay && !isValidDate(rawEnd)) {
      validationErrors.push(`Row ${rowIndex}: End must be a valid date for a timed event.`);
      return;
    }

    const end = allDay && !isValidDate(rawEnd) ? rawStart : rawEnd;
    if (!isValidDate(end)) {
      validationErrors.push(`Row ${rowIndex}: End must be a valid date.`);
      return;
    }
    if (!allDay && end.getTime() <= rawStart.getTime()) {
      validationErrors.push(`Row ${rowIndex}: End must be after Start.`);
      return;
    }

    const row: ActiveSheetRow = {
      rowIndex,
      eventId,
      title,
      start: rawStart,
      end,
    };

    if (allDay) {
      row.allDay = true;
    }
    rows.push(row);
  });

  const firstRowByEventId = new Map<string, number>();
  rows.forEach((row) => {
    if (row.eventId === null) return;
    const firstRow = firstRowByEventId.get(row.eventId);
    if (firstRow !== undefined) {
      validationErrors.push(`Row ${row.rowIndex}: Event ID duplicates row ${firstRow}.`);
    } else {
      firstRowByEventId.set(row.eventId, row.rowIndex);
    }
  });

  if (validationErrors.length > 0) {
    throw new Error(`Fix the Events sheet before syncing:\n${validationErrors.join('\n')}`);
  }

  return rows;
}
