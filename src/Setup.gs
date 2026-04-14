function setupDataStore() {
  var ss = SpreadsheetApp.create('Porta Moneta GAS - Data Store');

  getOrCreateSheet_(ss, APP.SHEETS.MEMBERS, APP.HEADERS.members);
  getOrCreateSheet_(ss, APP.SHEETS.ORDER_CYCLES, APP.HEADERS.order_cycles);
  getOrCreateSheet_(ss, APP.SHEETS.PRODUCTS, APP.HEADERS.products);
  getOrCreateSheet_(ss, APP.SHEETS.ORDERS, APP.HEADERS.orders);
  getOrCreateSheet_(ss, APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries);
  getOrCreateSheet_(ss, APP.SHEETS.AUDIT_LOG, APP.HEADERS.audit_log);

  var defaultSheet = ss.getSheetByName('Foglio1') || ss.getSheetByName('Sheet1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }

  setDataSpreadsheetId(ss.getId());
  return {
    ok: true,
    spreadsheet_id: ss.getId(),
    spreadsheet_url: ss.getUrl()
  };
}

function seedSampleData() {
  var sessionEmail = normalizeEmail_(Session.getActiveUser().getEmail());
  assert_(sessionEmail, 'Current user email is required for seed admin account.');

  var members = [{
    member_id: generateId_('mem'),
    full_name: 'Admin User',
    email: sessionEmail,
    role: APP.ROLE.ADMIN,
    active: true,
    created_at: nowIso_(),
    updated_at: nowIso_()
  }];

  overwriteSheetObjects_(APP.SHEETS.MEMBERS, APP.HEADERS.members, members);
  overwriteSheetObjects_(APP.SHEETS.ORDER_CYCLES, APP.HEADERS.order_cycles, []);
  overwriteSheetObjects_(APP.SHEETS.PRODUCTS, APP.HEADERS.products, []);
  overwriteSheetObjects_(APP.SHEETS.ORDERS, APP.HEADERS.orders, []);
  overwriteSheetObjects_(APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries, []);
  overwriteSheetObjects_(APP.SHEETS.AUDIT_LOG, APP.HEADERS.audit_log, []);

  return { ok: true, seeded_admin_email: sessionEmail };
}
