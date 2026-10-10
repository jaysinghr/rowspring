/** Spreadsheet entry points and menu wiring. */

function onOpen() {
  // Build the menu first: before the user authorizes, onOpen runs without
  // access to the spreadsheet or script properties, and must not throw.
  SpreadsheetApp.getUi()
    .createMenu('Rowspring')
    .addItem('Open sidebar', 'showRowspringSidebar')
    .addItem('Sync now', 'syncNow')
    .addSeparator()
    .addItem('Set up or repair sheets', 'setupRowspring')
    .addItem('Open activity log', 'openRowspringLog')
    .addToUi();

  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (spreadsheet) rowspringRememberSpreadsheet(spreadsheet);
  } catch (error) {
    // Not authorized yet; the spreadsheet is remembered on first sidebar open.
  }
}

function onInstall() {
  onOpen();
}

function showRowspringSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Rowspring');
  SpreadsheetApp.getUi().showSidebar(html);
}
