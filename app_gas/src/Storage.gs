/* ───────────────────────────────────────────
   Storage.gs — Sheet CRUD layer + CacheService
   ─────────────────────────────────────────── */

var CACHE_TTL_ = 300; // 5 minuti

function getDataSpreadsheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty(APP.PROP_DATA_SPREADSHEET_ID);
  assert_(id, 'Proprietà DATA_SPREADSHEET_ID mancante. Eseguire setupDataStore() o setDataSpreadsheetId(id).');
  return id;
}

function setDataSpreadsheetId(id) {
  assert_(id, 'Spreadsheet id obbligatorio.');
  PropertiesService.getScriptProperties().setProperty(APP.PROP_DATA_SPREADSHEET_ID, id);
  return { dataSpreadsheetId: id };
}

var _cachedSpreadsheet = null;

function getDataSpreadsheet_() {
  if (!_cachedSpreadsheet) {
    _cachedSpreadsheet = SpreadsheetApp.openById(getDataSpreadsheetId_());
  }
  return _cachedSpreadsheet;
}

/* ── Cache layer ── */

function getCacheKey_(sheetName) {
  return 'sheet_' + sheetName;
}

function readFromCache_(sheetName) {
  var cache = CacheService.getScriptCache();
  var raw = cache.get(getCacheKey_(sheetName));
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Cache corrotta, ignora
    }
  }
  return null;
}

function writeToCache_(sheetName, objects) {
  var cache = CacheService.getScriptCache();
  var json = JSON.stringify(objects);
  // CacheService ha limite 100KB per chiave
  if (json.length < 100000) {
    cache.put(getCacheKey_(sheetName), json, CACHE_TTL_);
  }
}

function invalidateCache_(sheetName) {
  var cache = CacheService.getScriptCache();
  cache.remove(getCacheKey_(sheetName));
}

/* ── Sheet helpers ── */

function getOrCreateSheet_(ss, sheetName, headers) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ── Read ── */

function readSheetObjects_(sheetName) {
  // Prova dalla cache
  var cached = readFromCache_(sheetName);
  if (cached) return cached;

  // Leggi da Sheets
  var sh = getDataSpreadsheet_().getSheetByName(sheetName);
  assert_(sh, 'Sheet mancante: ' + sheetName);
  var data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var objects = data.slice(1)
    .filter(function(row) { return row.join('') !== ''; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        var v = row[i];
        obj[h] = (v instanceof Date) ? v.toISOString() : v;
      });
      return obj;
    });

  // Salva in cache
  writeToCache_(sheetName, objects);
  return objects;
}

function readSheetObjectsWhere_(sheetName, filterCol, filterValue) {
  var all = readSheetObjects_(sheetName);
  return all.filter(function(obj) {
    return String(obj[filterCol]) === String(filterValue);
  });
}

/* ── Write ── */

function overwriteSheetObjects_(sheetName, headers, objects) {
  var ss = getDataSpreadsheet_();
  var sh = getOrCreateSheet_(ss, sheetName, headers);
  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!objects.length) {
    invalidateCache_(sheetName);
    return;
  }
  var rows = objects.map(function(obj) {
    return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  });
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  invalidateCache_(sheetName);
}

function appendSheetObject_(sheetName, headers, obj) {
  var sh = getOrCreateSheet_(getDataSpreadsheet_(), sheetName, headers);
  var row = headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
  invalidateCache_(sheetName);
}

function appendSheetObjects_(sheetName, headers, objects) {
  if (!objects.length) return;
  var sh = getOrCreateSheet_(getDataSpreadsheet_(), sheetName, headers);
  var rows = objects.map(function(obj) {
    return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  invalidateCache_(sheetName);
}
