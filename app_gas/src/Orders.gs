/* ───────────────────────────────────────────
   Orders.gs — Ordini member
   ─────────────────────────────────────────── */

function getMemberDashboard(payload) {
  var member = requireSession_(payload);
  var cycle  = getOpenCycle_();
  var balance = getMemberBalance_(member.member_id);

  var result = {
    member_id:  member.member_id,
    full_name:  member.full_name,
    role:       member.role,
    balance:    balance,
    cycle:      null,
    products:   [],
    my_lines:   [],
    order_total: 0
  };

  if (!cycle) return result;

  result.cycle = cycle;

  // Verifica accesso: cicli 'attivi' escludono i soci
  var canOrder = cycle.access_level === APP.ACCESS_LEVEL.ALL ||
    !cycle.access_level ||
    member.role === APP.ROLE.ADMIN ||
    member.role === APP.ROLE.ATTIVO;

  if (!canOrder) {
    result.cycle_restricted = true;
    return result;
  }

  result.products = getCycleProducts_(cycle.cycle_id);

  var myOrders = readSheetObjectsWhere_(APP.SHEETS.ORDERS, 'cycle_id', cycle.cycle_id)
    .filter(function(o) { return o.member_id === member.member_id; });

  var orderTotal = 0;
  result.my_lines = myOrders.map(function(o) {
    var lt = toNumber_(o.line_total);
    orderTotal += lt;
    return {
      product_id:          o.product_id,
      quantity:            toNumber_(o.quantity),
      unit_price_snapshot: toNumber_(o.unit_price_snapshot),
      line_total:          lt
    };
  });
  result.order_total = Math.round(orderTotal * 100) / 100;

  return result;
}

function saveMyOrder(payload) {
  var member = requireSession_(payload);
  assert_(payload.cycle_id, 'cycle_id obbligatorio.');
  assert_(payload.lines, 'Righe ordine mancanti.');

  var cycle = getOpenCycle_();
  assert_(cycle && cycle.cycle_id === payload.cycle_id,
    'Il ciclo non è aperto. Non è possibile modificare l\'ordine.');

  if (cycle.access_level === APP.ACCESS_LEVEL.ATTIVI) {
    assert_(
      member.role === APP.ROLE.ADMIN || member.role === APP.ROLE.ATTIVO,
      'Questo ciclo è riservato ai soci attivi.'
    );
  }

  var products = getCycleProducts_(cycle.cycle_id);
  var productMap = {};
  products.forEach(function(p) { productMap[p.product_id] = p; });

  // Carica tutti gli ordini del ciclo
  var allOrders = readSheetObjectsWhere_(APP.SHEETS.ORDERS, 'cycle_id', cycle.cycle_id);

  // Rimuovi le righe esistenti di questo member per questo ciclo
  var othersOrders = allOrders.filter(function(o) {
    return o.member_id !== member.member_id;
  });

  // Crea le nuove righe (solo quantità > 0)
  var now = nowIso_();
  var newLines = [];
  var orderTotal = 0;

  payload.lines.forEach(function(line) {
    var qty = toNumber_(line.quantity);
    if (qty <= 0) return;

    var product = productMap[line.product_id];
    assert_(product, 'Prodotto non trovato: ' + line.product_id);

    var price = toNumber_(product.unit_price);
    var lineTotal = Math.round(qty * price * 100) / 100;
    orderTotal += lineTotal;

    newLines.push({
      order_line_id:      generateId_('ord'),
      cycle_id:           cycle.cycle_id,
      member_id:          member.member_id,
      product_id:         line.product_id,
      quantity:           qty,
      unit_price_snapshot: price,
      line_total:         lineTotal,
      updated_at:         now
    });
  });

  // Riscrivi tutti gli ordini del ciclo (altri + nuovi miei)
  var allCycleOrders = othersOrders.concat(newLines);

  // Carica anche ordini di altri cicli
  var allSheetOrders = readSheetObjects_(APP.SHEETS.ORDERS);
  var otherCycleOrders = allSheetOrders.filter(function(o) {
    return o.cycle_id !== cycle.cycle_id;
  });

  overwriteSheetObjects_(APP.SHEETS.ORDERS, APP.HEADERS.orders,
    otherCycleOrders.concat(allCycleOrders));

  return {
    saved:       true,
    lines_count: newLines.length,
    order_total: Math.round(orderTotal * 100) / 100
  };
}

function getMyOrderHistory(payload) {
  var member = requireSession_(payload);
  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  var orders = readSheetObjects_(APP.SHEETS.ORDERS)
    .filter(function(o) { return o.member_id === member.member_id; });

  // Raggruppa per ciclo
  var cycleMap = {};
  cycles.forEach(function(c) { cycleMap[c.cycle_id] = c; });

  var byC = {};
  orders.forEach(function(o) {
    if (!byC[o.cycle_id]) byC[o.cycle_id] = 0;
    byC[o.cycle_id] += toNumber_(o.line_total);
  });

  var history = [];
  for (var cid in byC) {
    var c = cycleMap[cid];
    if (!c) continue;
    history.push({
      cycle_id:    cid,
      title:       c.title,
      status:      c.status,
      pickup_date: c.pickup_date,
      order_total: Math.round(byC[cid] * 100) / 100
    });
  }

  history.sort(function(a, b) {
    return String(b.pickup_date).localeCompare(String(a.pickup_date));
  });

  return history.slice(0, 10);
}

function getMyOrderDetail(payload) {
  var member = requireSession_(payload);
  assert_(payload.cycle_id, 'cycle_id obbligatorio.');

  var orders = readSheetObjectsWhere_(APP.SHEETS.ORDERS, 'cycle_id', payload.cycle_id)
    .filter(function(o) { return o.member_id === member.member_id; });

  var products = readSheetObjectsWhere_(APP.SHEETS.PRODUCTS, 'cycle_id', payload.cycle_id);
  var productMap = {};
  products.forEach(function(p) { productMap[p.product_id] = p; });

  var total = 0;
  var lines = orders.map(function(o) {
    var lt = toNumber_(o.line_total);
    total += lt;
    var p = productMap[o.product_id] || {};
    return {
      product_name: p.name || '?',
      variant:      p.variant || '',
      format:       p.format || '',
      quantity:     toNumber_(o.quantity),
      unit_price:   toNumber_(o.unit_price_snapshot),
      line_total:   lt
    };
  });

  return { lines: lines, order_total: Math.round(total * 100) / 100 };
}
