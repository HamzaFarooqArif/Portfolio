function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Hamza Menu')
    .addItem('Read Aloud', 'readAloud')
    .addToUi();
}

function readAloud() {
  var html = doGet().setTitle('HTML Dialog');
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html), "Read Aloud");
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getSheetData() {
  try {
    // Replace with your actual Spreadsheet ID
    var spreadsheetId = '1qS7yrrPvKIIJ_OvuYEyw1dNYq2nWCLU2k-IAIc4hTyU';
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheets()[0]; // Get the first sheet

    var data = sheet.getDataRange().getValues();

    return data;
  } catch (e) {
    Logger.log('Error: ' + e.toString());
    return [['Error: ' + e.toString()]];
  }
}