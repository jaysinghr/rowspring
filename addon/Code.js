/** Spreadsheet entry points and menu wiring. */

function onOpen() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet) rowspringRememberSpreadsheet(spreadsheet);

  SpreadsheetApp.getUi()
    .createMenu('Rowspring')
    .addItem('Open sidebar', 'showRowspringSidebar')
    .addItem('Sync now', 'syncNow')
    .addSeparator()
    .addItem('Set up or repair sheets', 'setupRowspring')
    .addItem('Open activity log', 'openRowspringLog')
    .addToUi();
}

function onInstall() {
  onOpen();
}

function showRowspringSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Rowspring');
  SpreadsheetApp.getUi().showSidebar(html);
}
