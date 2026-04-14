function getDataSpreadsheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty(APP.PROP_DATA_SPREADSHEET_ID);
  assert_(id, 'Missing script property DATA_SPREADSHEET_ID. Run setupDataStore() or setDataSpreadsheetId(id).');
  return id;
}

function setDataSpreadsheetId(id) {
  assert_(id, 'Spreadsheet id is required.');
  PropertiesService.getScriptProperties().setProperty(APP.PROP_DATA_SPREADSHEET_ID, id);
  return { ok: true, dataSpreadsheetId: id };
}

function getDataSpreadsheet_() {
  return SpreadsheetApp.openById(getDataSpreadsheetId_());
}

function getOrCreateSheet_(ss, sheetName, headers) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  var currentHeaders = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  var mismatch = headers.some(function(h, i) { return currentHeaders[i] !== h; });
  if (mismatch) {
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readSheetObjects_(sheetName) {
  var sh = getDataSpreadsheet_().getSheetByName(sheetName);
  assert_(sh, 'Missing sheet: ' + sheetName);
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  var headers = values[0];
  return values.slice(1).filter(function(row) {
    return row.join('') !== '';
  }).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i];
    });
    return obj;
  });
}

function overwriteSheetObjects_(sheetName, headers, objects) {
  var ss = getDataSpreadsheet_();
  var sh = getOrCreateSheet_(ss, sheetName, headers);
  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!objects.length) {
    return;
  }
  var rows = objects.map(function(obj) {
    return headers.map(function(h) { return obj[h]; });
  });
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function appendSheetObject_(sheetName, headers, obj) {
  var sh = getOrCreateSheet_(getDataSpreadsheet_(), sheetName, headers);
  var row = headers.map(function(h) { return obj[h]; });
  sh.appendRow(row);
}
