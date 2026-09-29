import { describe, expect, test } from 'vitest';
import { readSheetRows } from '../src/core/readSheetRows';

describe('readSheetRows', () => {
  const mapping = {
    eventId: 'Event ID',
    title: 'Title',
    start: 'Start',
    end: 'End',
    allDay: 'All Day',
    status: 'Status',
  };

  test('maps a header row and data rows into SheetRow objects using the mapped columns', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];
    const dataRows = [
      ['', 'Team standup', new Date('2026-10-01T09:00:00Z'), new Date('2026-10-01T09:30:00Z'), '', ''],
      ['evt-1', 'Renamed event', new Date('2026-10-02T09:00:00Z'), new Date('2026-10-02T09:30:00Z'), '', ''],
    ];
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

  test('rejects a sheet whose required headers are missing', () => {
    expect(() => readSheetRows(['Title', 'Start'], [], mapping, 2)).toThrow(
      'Missing required column(s): Event ID, End, All Day, Status',
    );
  });

  test('rejects duplicate required headers', () => {
    expect(() =>
      readSheetRows(['Event ID', 'Title', 'Title', 'Start', 'End', 'All Day', 'Status'], [], mapping, 2),
    ).toThrow('Duplicate required column(s): Title');
  });

  test('skips completely blank rows', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];

    expect(readSheetRows(header, [['', '', '', '', false, '']], mapping, 2)).toEqual([]);
  });

  test('reports invalid event rows before any sync can begin', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];
    const dataRows = [
      ['', '', new Date('2026-10-01T09:00:00Z'), new Date('2026-10-01T09:30:00Z'), false, ''],
      ['', 'Backwards event', new Date('2026-10-02T10:00:00Z'), new Date('2026-10-02T09:00:00Z'), false, ''],
      ['', 'Bad status', new Date('2026-10-03T09:00:00Z'), new Date('2026-10-03T09:30:00Z'), false, 'REMOVE'],
    ];

    expect(() => readSheetRows(header, dataRows, mapping, 2)).toThrow(
      [
        'Fix the Events sheet before syncing:',
        'Row 2: Title is required.',
        'Row 3: End must be after Start.',
        'Row 4: Status must be blank or DELETE.',
      ].join('\n'),
    );
  });

  test('allows an all-day event without an End value', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];
    const start = new Date('2026-12-25T00:00:00Z');

    expect(readSheetRows(header, [['', 'Company holiday', start, '', true, '']], mapping, 2)).toEqual([
      {
        rowIndex: 2,
        eventId: null,
        title: 'Company holiday',
        start,
        end: start,
        allDay: true,
      },
    ]);
  });

  test('allows DELETE rows with an id even when their event fields are blank', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];

    expect(readSheetRows(header, [['evt-1', '', '', '', false, 'delete']], mapping, 2)).toEqual([
      { rowIndex: 2, eventId: 'evt-1', title: '', status: 'DELETE' },
    ]);
  });

  test('rejects duplicate Event IDs that could target one calendar event twice', () => {
    const header = ['Event ID', 'Title', 'Start', 'End', 'All Day', 'Status'];
    const start = new Date('2026-10-01T09:00:00Z');
    const end = new Date('2026-10-01T09:30:00Z');

    expect(() =>
      readSheetRows(
        header,
        [
          ['evt-1', 'First row', start, end, false, ''],
          ['evt-1', 'Second row', start, end, false, ''],
        ],
        mapping,
        2,
      ),
    ).toThrow('Row 3: Event ID duplicates row 2.');
  });
});
