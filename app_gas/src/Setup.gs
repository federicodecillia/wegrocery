/* ───────────────────────────────────────────
   Setup.gs — Inizializzazione datastore
   ─────────────────────────────────────────── */

function setupDataStore() {
  var ss = SpreadsheetApp.create('Porta Moneta GAS — Dati');

  // Crea tutti gli sheet con headers
  var sheetNames = Object.keys(APP.HEADERS);
  sheetNames.forEach(function(name) {
    getOrCreateSheet_(ss, name, APP.HEADERS[name]);
  });

  // Rimuovi lo sheet di default
  var defaultSheet = ss.getSheetByName('Foglio1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Salva l'ID
  var id = ss.getId();
  setDataSpreadsheetId(id);

  return { spreadsheet_id: id, url: ss.getUrl() };
}

