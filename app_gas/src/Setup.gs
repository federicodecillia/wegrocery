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

function seedSampleData() {
  var email = getSessionEmail_();
  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  var alreadyExists = members.some(function(m) {
    return normalizeEmail_(m.email) === email;
  });

  if (!alreadyExists) {
    appendSheetObject_(APP.SHEETS.MEMBERS, APP.HEADERS.members, {
      member_id:  generateId_('mem'),
      full_name:  'Amministratore',
      email:      email,
      role:       APP.ROLE.ADMIN,
      active:     true,
      created_at: nowIso_(),
      updated_at: nowIso_()
    });
  }

  return { admin_email: email };
}
