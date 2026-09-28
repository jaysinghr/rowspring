import { describe, expect, test } from 'vitest';
import { readSheetRows } from '../src/core/readSheetRows';

describe('readSheetRows', () => {
  test('maps a header row and data rows into SheetRow objects using the mapped columns', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];
    const dataRows = [
      ['', 'Team standup', new Date('2026-10-01T09:00:00Z'), new Date('2026-10-01T09:30:00Z'), '', ''],
      ['evt-1', 'Renamed event', new Date('2026-10-02T09:00:00Z'), new Date('2026-10-02T09:30:00Z'), '', ''],
    ];
    const mapping = {
      eventId: 'Event ID',
      title: 'Title',
      start: 'Start',
      end: 'End',
      allDay: 'All Day',
      status: 'Status',
    };

    const rows = readSheetRows(header, dataRows, mapping, /* firstDataRowIndex */ 2);

    expect(rows).toEqual([
      {
        rowIndex: 2,
        eventId: null,
        title: 'Team standup',
        start: new Date('2026-10-01T09:00:00Z'),
        end: new Date('2026-10-01T09:30:00Z'),
      },
      {
        rowIndex: 3,
        eventId: 'evt-1',
        title: 'Renamed event',
        start: new Date('2026-10-02T09:00:00Z'),
        end: new Date('2026-10-02T09:30:00Z'),
      },
    ]);
  });

  test('reads the all-day checkbox and DELETE status columns', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];
    const dataRows = [
      [
        'evt-1',
        'Company holiday',
        new Date('2026-12-25T00:00:00Z'),
        new Date('2026-12-25T00:00:00Z'),
        true,
        '',
      ],
      [
        'evt-2',
        'Cancelled meeting',
        new Date('2026-10-05T09:00:00Z'),
        new Date('2026-10-05T09:30:00Z'),
        false,
        'DELETE',
      ],
    ];
    const mapping = {
      eventId: 'Event ID',
      title: 'Title',
      start: 'Start',
      end: 'End',
      allDay: 'All Day',
      status: 'Status',
    };

    const rows = readSheetRows(header, dataRows, mapping, 2);

    expect(rows).toEqual([
      {
        rowIndex: 2,
        eventId: 'evt-1',
        title: 'Company holiday',
        start: new Date('2026-12-25T00:00:00Z'),
        end: new Date('2026-12-25T00:00:00Z'),
        allDay: true,
      },
      {
        rowIndex: 3,
        eventId: 'evt-2',
        title: 'Cancelled meeting',
        start: new Date('2026-10-05T09:00:00Z'),
        end: new Date('2026-10-05T09:30:00Z'),
        status: 'DELETE',
      },
    ]);
  });
});
