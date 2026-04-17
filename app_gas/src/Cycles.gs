/* ───────────────────────────────────────────
   Cycles.gs — Gestione cicli d'ordine
   ─────────────────────────────────────────── */

function getOpenCycle_() {
  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  for (var i = 0; i < cycles.length; i++) {
    if (cycles[i].status === APP.CYCLE_STATUS.OPEN) {
      return cycles[i];
    }
  }
  return null;
}

function getOpenCycle(payload) {
  requireSession_(payload);
  return getOpenCycle_();
}

function adminGetRecentCycles(payload) {
  requireAdmin_(payload);
  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  cycles.sort(function(a, b) {
    return String(b.created_at).localeCompare(String(a.created_at));
  });
  return cycles.slice(0, 10);
}

function adminCreateCycle(payload) {
  var admin = requireAdmin_(payload);
  assert_(payload.title, 'Titolo obbligatorio.');
  assert_(payload.order_close_at, 'Data chiusura ordine obbligatoria.');

  var existing = getOpenCycle_();
  assert_(!existing, 'Esiste già un ciclo aperto: "' + (existing && existing.title) + '". Chiudilo prima di crearne uno nuovo.');

  var accessLevel = payload.access_level || APP.ACCESS_LEVEL.ATTIVI;
  assert_(
    accessLevel === APP.ACCESS_LEVEL.ATTIVI || accessLevel === APP.ACCESS_LEVEL.ALL,
    'Valore access_level non valido.'
  );

  var now = nowIso_();
  var cycle = {
    cycle_id:       generateId_('cyc'),
    title:          payload.title,
    pickup_date:    payload.pickup_date || '',
    order_open_at:  payload.order_open_at || now,
    order_close_at: payload.order_close_at,
    status:         APP.CYCLE_STATUS.OPEN,
    access_level:   accessLevel,
    notes:          payload.notes || '',
    created_by:     admin.email,
    created_at:     now,
    closed_at:      ''
  };

  appendSheetObject_(APP.SHEETS.ORDER_CYCLES, APP.HEADERS.order_cycles, cycle);
  logAudit_(admin.email, 'create_cycle', 'cycle', cycle.cycle_id, payload);
  return cycle;
}

function adminCloseCycle(payload) {
  var admin = requireAdmin_(payload);
  assert_(payload.cycle_id, 'cycle_id obbligatorio.');

  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  var cycle = null;
  for (var i = 0; i < cycles.length; i++) {
    if (cycles[i].cycle_id === payload.cycle_id) {
      cycle = cycles[i];
      assert_(cycle.status === APP.CYCLE_STATUS.OPEN,
        'Solo un ciclo aperto può essere chiuso. Stato attuale: ' + cycle.status);
      cycles[i].status = APP.CYCLE_STATUS.CLOSED;
      cycles[i].closed_at = nowIso_();
      break;
    }
  }
  assert_(cycle, 'Ciclo non trovato: ' + payload.cycle_id);

  overwriteSheetObjects_(APP.SHEETS.ORDER_CYCLES, APP.HEADERS.order_cycles, cycles);

  // Genera addebiti
  var chargesGenerated = generateOrderCharges_(payload.cycle_id, admin.email);

  logAudit_(admin.email, 'close_cycle', 'cycle', payload.cycle_id,
    { charges_generated: chargesGenerated });

  return { closed: true, charges_generated: chargesGenerated };
}
