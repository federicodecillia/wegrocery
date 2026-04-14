/* ───────────────────────────────────────────
   Ledger.gs — Contabilità soci
   ─────────────────────────────────────────── */

function getMemberBalance_(memberId) {
  var entries = readSheetObjectsWhere_(APP.SHEETS.LEDGER_ENTRIES, 'member_id', memberId);
  var sum = 0;
  entries.forEach(function(e) { sum += toNumber_(e.amount); });
  return Math.round(sum * 100) / 100;
}

function getMyLedger(payload) {
  var member = requireSession_(payload);
  var entries = readSheetObjectsWhere_(APP.SHEETS.LEDGER_ENTRIES, 'member_id', member.member_id);
  entries.sort(function(a, b) {
    return String(b.created_at).localeCompare(String(a.created_at));
  });
  return entries.slice(0, 25).map(function(e) {
    return {
      entry_date: e.entry_date,
      type:       e.type,
      amount:     toNumber_(e.amount),
      note:       e.note,
      cycle_id:   e.cycle_id
    };
  });
}

function generateOrderCharges_(cycleId, adminEmail) {
  // Controlla che non ci siano già addebiti per questo ciclo
  var existing = readSheetObjectsWhere_(APP.SHEETS.LEDGER_ENTRIES, 'cycle_id', cycleId)
    .filter(function(e) { return e.type === APP.LEDGER_TYPE.ORDER_CHARGE; });
  if (existing.length > 0) return 0; // idempotente

  var orders = readSheetObjectsWhere_(APP.SHEETS.ORDERS, 'cycle_id', cycleId);

  // Raggruppa totale per member
  var memberTotals = {};
  orders.forEach(function(o) {
    var mid = o.member_id;
    if (!memberTotals[mid]) memberTotals[mid] = 0;
    memberTotals[mid] += toNumber_(o.line_total);
  });

  var now = nowIso_();
  var entries = [];

  for (var mid in memberTotals) {
    var total = memberTotals[mid];
    if (total <= 0) continue;

    entries.push({
      entry_id:   generateId_('led'),
      member_id:  mid,
      entry_date: now.substring(0, 10),
      type:       APP.LEDGER_TYPE.ORDER_CHARGE,
      amount:     -Math.round(total * 100) / 100,
      cycle_id:   cycleId,
      note:       'Addebito ordine',
      created_by: adminEmail,
      created_at: now
    });
  }

  if (entries.length) {
    appendSheetObjects_(APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries, entries);
  }

  return entries.length;
}

function adminRecordTopup(payload) {
  var admin = requireAdmin_(payload);
  assert_(payload.member_id, 'member_id obbligatorio.');
  assert_(payload.amount, 'Importo obbligatorio.');

  var amount = toNumber_(payload.amount);
  assert_(amount > 0, 'L\'importo deve essere positivo.');

  // Verifica che il socio esista
  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  var found = false;
  for (var i = 0; i < members.length; i++) {
    if (members[i].member_id === payload.member_id) { found = true; break; }
  }
  assert_(found, 'Socio non trovato.');

  var now = nowIso_();
  var entry = {
    entry_id:   generateId_('led'),
    member_id:  payload.member_id,
    entry_date: payload.entry_date || now.substring(0, 10),
    type:       APP.LEDGER_TYPE.TOPUP,
    amount:     amount,
    cycle_id:   '',
    note:       payload.note || 'Bonifico',
    created_by: admin.email,
    created_at: now
  };

  appendSheetObject_(APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries, entry);
  logAudit_(admin.email, 'record_topup', 'ledger', entry.entry_id, payload);
  return { entry_id: entry.entry_id, new_balance: getMemberBalance_(payload.member_id) };
}

function adminGetBalances(payload) {
  requireAdmin_(payload);
  var members = readSheetObjects_(APP.SHEETS.MEMBERS)
    .filter(function(m) { return String(m.active) !== 'false'; });
  var ledger = readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES);

  var balances = {};
  ledger.forEach(function(e) {
    if (!balances[e.member_id]) balances[e.member_id] = 0;
    balances[e.member_id] += toNumber_(e.amount);
  });

  return members.map(function(m) {
    return {
      member_id: m.member_id,
      full_name: m.full_name,
      email:     m.email,
      balance:   Math.round((balances[m.member_id] || 0) * 100) / 100
    };
  }).sort(function(a, b) { return a.full_name.localeCompare(b.full_name); });
}
