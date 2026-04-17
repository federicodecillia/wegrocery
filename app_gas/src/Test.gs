/* ───────────────────────────────────────────
   Test.gs — Utilità e diagnostica
   Eseguire dall'editor Apps Script
   ─────────────────────────────────────────── */

/**
 * Verifica infrastruttura: spreadsheet, sheet, soci, saldo.
 * runSmokeTest()
 */
function runSmokeTest() {
  Logger.log('═══ SMOKE TEST ═══');
  var errors = [];

  var ss;
  try {
    ss = getDataSpreadsheet_();
    Logger.log('✓ Spreadsheet accessibile');
  } catch (e) {
    Logger.log('✗ Spreadsheet: ' + e.message);
    return { ok: false, errors: [e.message] };
  }

  Object.keys(APP.SHEETS).forEach(function(key) {
    var sh = ss.getSheetByName(APP.SHEETS[key]);
    if (sh) Logger.log('✓ Sheet: ' + APP.SHEETS[key]);
    else { Logger.log('✗ Sheet mancante: ' + APP.SHEETS[key]); errors.push('Sheet mancante: ' + APP.SHEETS[key]); }
  });

  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  if (members.length > 0) {
    Logger.log('✓ Soci: ' + members.length);
    var balance = getMemberBalance_(members[0].member_id);
    if (typeof balance !== 'number') { Logger.log('✗ Saldo non calcolabile'); errors.push('Saldo non è un numero'); }
    else Logger.log('✓ Saldo ' + members[0].full_name + ': €' + balance);
  } else {
    Logger.log('✗ Nessun socio trovato'); errors.push('Nessun socio');
  }

  var cycle = getOpenCycle_();
  Logger.log(cycle ? '✓ Ciclo aperto: "' + cycle.title + '"' : '○ Nessun ciclo aperto');

  Logger.log(errors.length === 0 ? '✓ Tutto OK' : '✗ ' + errors.length + ' errori');
  return { ok: errors.length === 0, errors: errors };
}

/**
 * Aggiunge/aggiorna i soci fondamentali (admin + soci con email).
 * setupMembers()
 */
function setupMembers() {
  var members = [
    { full_name: 'Manuel Rizzo',      email: 'manuel.rizzo@portamoneta.org',      role: 'admin',  active: true },
    { full_name: 'Nadia Di Simine',   email: 'nadia.disimine@portamoneta.org',    role: 'admin',  active: true },
    { full_name: 'Maria Malacrino',   email: 'maria.malacrino@portamoneta.org',   role: 'admin',  active: true },
    { full_name: 'Maria Fois',        email: 'maria.fois@portamoneta.org',        role: 'attivo', active: true }
  ];

  Logger.log('═══ SETUP SOCI ═══');
  members.forEach(function(m) {
    var result = callApi('adminUpsertMember', m);
    Logger.log((result.ok ? '✓' : '✗') + ' ' + m.full_name + ' (' + m.role + ')' +
      (result.ok ? '' : ' — ' + result.error.message));
  });

  var all = callApi('adminGetMembers', {});
  if (all.ok) {
    Logger.log('──────────────────────────');
    all.result.forEach(function(m) {
      Logger.log('  ' + m.full_name + ' | ' + m.email + ' | ' + m.role);
    });
  }
}

/**
 * Riepilogo completo di tutti i dati nel foglio.
 * listAllData()
 */
function listAllData() {
  Logger.log('═══ RIEPILOGO DATI ═══');

  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  Logger.log('\n── Cicli (' + cycles.length + ') ──');
  cycles.forEach(function(c) {
    Logger.log('  ' + c.title + ' | ' + c.status + ' | ' + c.pickup_date + ' | ' + c.cycle_id);
  });

  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  Logger.log('\n── Soci (' + members.length + ') ──');
  members.forEach(function(m) {
    var bal = getMemberBalance_(m.member_id);
    Logger.log('  ' + m.full_name + ' | ' + (m.email || '—') + ' | ' + m.role + ' | attivo:' + m.active + ' | saldo:€' + bal);
  });

  var products = readSheetObjects_(APP.SHEETS.PRODUCTS);
  Logger.log('\n── Prodotti: ' + products.length + ' righe ──');

  var orders = readSheetObjects_(APP.SHEETS.ORDERS);
  Logger.log('── Ordini: ' + orders.length + ' righe ──');

  var ledger = readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES);
  var types = {};
  ledger.forEach(function(e) { types[e.type] = (types[e.type] || 0) + 1; });
  Logger.log('── Movimenti: ' + ledger.length + ' | ' +
    Object.keys(types).map(function(t) { return t + ':' + types[t]; }).join(', '));
}
