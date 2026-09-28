/**
 * Smoke test only — confirms clasp push -> real Apps Script -> real Sheet
 * works end to end. Will be replaced by the real add-on entry points
 * (onOpen menu, sidebar, CalendarClient) once this round-trip is proven.
 */
function pingRowspring() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  sheet.toast('Rowspring dev push reached this sheet.', 'Rowspring', 5);
  Logger.log('pingRowspring ran at ' + new Date().toISOString());
  return 'ok';
}
