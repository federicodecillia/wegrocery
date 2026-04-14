function getOpenCycle_() {
  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  return cycles.find(function(c) { return c.status === APP.CYCLE_STATUS.OPEN; }) || null;
}

function getCycleProducts_(cycleId) {
  return readSheetObjects_(APP.SHEETS.PRODUCTS)
    .filter(function(p) {
      return p.cycle_id === cycleId && String(p.active).toUpperCase() === 'TRUE';
    })
    .sort(function(a, b) {
      return toNumber_(a.sort_order) - toNumber_(b.sort_order);
    });
}

function getMemberOrdersForCycle_(memberId, cycleId) {
  return readSheetObjects_(APP.SHEETS.ORDERS).filter(function(o) {
    return o.member_id === memberId && o.cycle_id === cycleId;
  });
}

function getMemberBalance_(memberId) {
  return readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES)
    .filter(function(e) { return e.member_id === memberId; })
    .reduce(function(acc, entry) {
      return acc + toNumber_(entry.amount);
    }, 0);
}

function getOpenCycle() {
  requireSession_();
  return getOpenCycle_();
}

function getMemberDashboard() {
  var session = requireSession_();
  var openCycle = getOpenCycle_();
  var products = [];
  var orderLines = [];
  var total = 0;

  if (openCycle) {
    products = getCycleProducts_(openCycle.cycle_id);
    orderLines = getMemberOrdersForCycle_(session.member_id, openCycle.cycle_id);
    total = orderLines.reduce(function(acc, line) {
      return acc + toNumber_(line.line_total);
    }, 0);
  }

  var allCycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  var allOrders = readSheetObjects_(APP.SHEETS.ORDERS);
  var allLedger = readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES);

  var myOrders = allOrders.filter(function(o) { return o.member_id === session.member_id; });
  var totalsByCycle = {};
  myOrders.forEach(function(line) {
    var cycleId = line.cycle_id;
    totalsByCycle[cycleId] = (totalsByCycle[cycleId] || 0) + toNumber_(line.line_total);
  });
  var orderHistory = allCycles
    .filter(function(c) { return totalsByCycle[c.cycle_id]; })
    .map(function(c) {
      return {
        cycle_id: c.cycle_id,
        title: c.title,
        pickup_date: c.pickup_date,
        status: c.status,
        total: Number(totalsByCycle[c.cycle_id].toFixed(2))
      };
    })
    .sort(function(a, b) { return String(b.pickup_date).localeCompare(String(a.pickup_date)); })
    .slice(0, 10);

  var myLedger = allLedger
    .filter(function(e) { return e.member_id === session.member_id; })
    .sort(function(a, b) { return String(b.entry_date).localeCompare(String(a.entry_date)); })
    .slice(0, 25);

  return {
    session: session,
    open_cycle: openCycle,
    products: products,
    my_order_lines: orderLines,
    my_order_total: Number(total.toFixed(2)),
    my_balance: Number(getMemberBalance_(session.member_id).toFixed(2)),
    order_history: orderHistory,
    ledger: myLedger
  };
}

function saveMyOrder(payload) {
  var session = requireSession_();
  assert_(payload && payload.cycle_id, 'cycle_id is required');
  assert_(Array.isArray(payload.lines), 'lines must be an array');

  var cycle = getOpenCycle_();
  assert_(cycle && cycle.cycle_id === payload.cycle_id, 'Cycle is not open.');

  var products = getCycleProducts_(payload.cycle_id);
  var productMap = {};
  products.forEach(function(p) { productMap[p.product_id] = p; });

  var allOrders = readSheetObjects_(APP.SHEETS.ORDERS);
  allOrders = allOrders.filter(function(o) {
    return !(o.cycle_id === payload.cycle_id && o.member_id === session.member_id);
  });

  payload.lines.forEach(function(line) {
    var product = productMap[line.product_id];
    assert_(product, 'Invalid product_id: ' + line.product_id);
    var quantity = toNumber_(line.quantity);
    assert_(quantity >= 0, 'quantity must be >= 0');
    if (quantity === 0) {
      return;
    }
    var unitPrice = toNumber_(product.unit_price);
    allOrders.push({
      order_line_id: generateId_('ord'),
      cycle_id: payload.cycle_id,
      member_id: session.member_id,
      product_id: line.product_id,
      quantity: quantity,
      unit_price_snapshot: unitPrice,
      line_total: Number((unitPrice * quantity).toFixed(2)),
      updated_at: nowIso_()
    });
  });

  overwriteSheetObjects_(APP.SHEETS.ORDERS, APP.HEADERS.orders, allOrders);
  logAudit_(session, 'save_my_order', 'order_cycle', payload.cycle_id, { lines_count: payload.lines.length });

  return getMemberDashboard();
}

function getMyOrderHistory() {
  var session = requireSession_();
  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  var orders = readSheetObjects_(APP.SHEETS.ORDERS).filter(function(o) {
    return o.member_id === session.member_id;
  });

  var totalsByCycle = {};
  orders.forEach(function(line) {
    var cycleId = line.cycle_id;
    totalsByCycle[cycleId] = (totalsByCycle[cycleId] || 0) + toNumber_(line.line_total);
  });

  return cycles
    .filter(function(c) { return totalsByCycle[c.cycle_id]; })
    .map(function(c) {
      return {
        cycle_id: c.cycle_id,
        title: c.title,
        pickup_date: c.pickup_date,
        status: c.status,
        total: Number(totalsByCycle[c.cycle_id].toFixed(2))
      };
    })
    .sort(function(a, b) {
      return String(b.pickup_date).localeCompare(String(a.pickup_date));
    })
    .slice(0, 10);
}

function getMyLedger() {
  var session = requireSession_();
  return readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES)
    .filter(function(e) { return e.member_id === session.member_id; })
    .sort(function(a, b) {
      return String(b.entry_date).localeCompare(String(a.entry_date));
    })
    .slice(0, 25);
}
