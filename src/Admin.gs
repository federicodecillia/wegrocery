function adminCreateCycle(payload) {
  var session = requireAdmin_();
  assert_(payload && payload.title, 'title is required');
  assert_(payload.pickup_date, 'pickup_date is required');
  assert_(payload.order_open_at, 'order_open_at is required');
  assert_(payload.order_close_at, 'order_close_at is required');

  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  var openCycle = cycles.find(function(c) { return c.status === APP.CYCLE_STATUS.OPEN; });
  assert_(!openCycle, 'An open cycle already exists. Close it first.');

  var cycleId = generateId_('cyc');
  cycles.push({
    cycle_id: cycleId,
    title: payload.title,
    pickup_date: payload.pickup_date,
    order_open_at: payload.order_open_at,
    order_close_at: payload.order_close_at,
    status: APP.CYCLE_STATUS.OPEN,
    notes: payload.notes || '',
    created_by: session.email,
    created_at: nowIso_(),
    closed_at: ''
  });

  overwriteSheetObjects_(APP.SHEETS.ORDER_CYCLES, APP.HEADERS.order_cycles, cycles);
  logAudit_(session, 'admin_create_cycle', 'order_cycle', cycleId, payload);
  return { ok: true, cycle_id: cycleId };
}

function adminUpdateProducts(payload) {
  var session = requireAdmin_();
  assert_(payload && payload.cycle_id, 'cycle_id is required');
  assert_(Array.isArray(payload.products), 'products must be an array');

  var allProducts = readSheetObjects_(APP.SHEETS.PRODUCTS).filter(function(p) {
    return p.cycle_id !== payload.cycle_id;
  });

  payload.products.forEach(function(p, index) {
    assert_(p.name, 'product name is required');
    assert_(toNumber_(p.unit_price) >= 0, 'unit_price must be >= 0');
    allProducts.push({
      product_id: p.product_id || generateId_('prd'),
      cycle_id: payload.cycle_id,
      name: p.name,
      variant: p.variant || '',
      format: p.format || '',
      unit_price: Number(toNumber_(p.unit_price).toFixed(2)),
      supplier: p.supplier || '',
      notes: p.notes || '',
      sort_order: p.sort_order || (index + 1),
      active: String(p.active) === 'false' ? false : true
    });
  });

  overwriteSheetObjects_(APP.SHEETS.PRODUCTS, APP.HEADERS.products, allProducts);
  logAudit_(session, 'admin_update_products', 'order_cycle', payload.cycle_id, { products_count: payload.products.length });
  return { ok: true };
}

function adminCloseCycle(cycleId) {
  var session = requireAdmin_();
  assert_(cycleId, 'cycleId is required');

  var cycles = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);
  var cycle = cycles.find(function(c) { return c.cycle_id === cycleId; });
  assert_(cycle, 'Cycle not found.');
  assert_(cycle.status === APP.CYCLE_STATUS.OPEN, 'Only open cycles can be closed.');

  var members = readSheetObjects_(APP.SHEETS.MEMBERS).filter(function(m) {
    return String(m.active).toUpperCase() === 'TRUE';
  });
  var orders = readSheetObjects_(APP.SHEETS.ORDERS).filter(function(o) {
    return o.cycle_id === cycleId;
  });

  var totalsByMember = {};
  orders.forEach(function(o) {
    totalsByMember[o.member_id] = (totalsByMember[o.member_id] || 0) + toNumber_(o.line_total);
  });

  var ledger = readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES);
  var existingCharges = {};
  ledger.forEach(function(e) {
    if (e.cycle_id === cycleId && e.type === APP.LEDGER_TYPE.ORDER_CHARGE) {
      existingCharges[e.member_id] = true;
    }
  });

  members.forEach(function(m) {
    var total = Number((totalsByMember[m.member_id] || 0).toFixed(2));
    if (total <= 0 || existingCharges[m.member_id]) {
      return;
    }
    ledger.push({
      entry_id: generateId_('led'),
      member_id: m.member_id,
      entry_date: cycle.pickup_date,
      type: APP.LEDGER_TYPE.ORDER_CHARGE,
      amount: Number((-total).toFixed(2)),
      cycle_id: cycleId,
      note: 'Order charge ' + cycle.title,
      created_by: session.email,
      created_at: nowIso_()
    });
  });

  cycle.status = APP.CYCLE_STATUS.CLOSED;
  cycle.closed_at = nowIso_();

  overwriteSheetObjects_(APP.SHEETS.ORDER_CYCLES, APP.HEADERS.order_cycles, cycles);
  overwriteSheetObjects_(APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries, ledger);

  logAudit_(session, 'admin_close_cycle', 'order_cycle', cycleId, { members_charged: Object.keys(totalsByMember).length });
  return { ok: true };
}

function adminRecordTopup(payload) {
  var session = requireAdmin_();
  assert_(payload && payload.member_id, 'member_id is required');
  assert_(payload.entry_date, 'entry_date is required');
  var amount = Number(toNumber_(payload.amount).toFixed(2));
  assert_(amount > 0, 'amount must be > 0');

  appendSheetObject_(APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries, {
    entry_id: generateId_('led'),
    member_id: payload.member_id,
    entry_date: payload.entry_date,
    type: APP.LEDGER_TYPE.TOPUP,
    amount: amount,
    cycle_id: payload.cycle_id || '',
    note: payload.note || '',
    created_by: session.email,
    created_at: nowIso_()
  });

  logAudit_(session, 'admin_record_topup', 'member', payload.member_id, payload);
  return { ok: true };
}

function adminGetBalances() {
  requireAdmin_();
  var members = readSheetObjects_(APP.SHEETS.MEMBERS).filter(function(m) {
    return String(m.active).toUpperCase() === 'TRUE';
  });
  var ledger = readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES);

  var sums = {};
  ledger.forEach(function(e) {
    sums[e.member_id] = (sums[e.member_id] || 0) + toNumber_(e.amount);
  });

  return members.map(function(m) {
    return {
      member_id: m.member_id,
      full_name: m.full_name,
      email: m.email,
      role: m.role,
      balance: Number((sums[m.member_id] || 0).toFixed(2))
    };
  }).sort(function(a, b) {
    return a.full_name.localeCompare(b.full_name);
  });
}

function adminGetCycleSummary(cycleId) {
  requireAdmin_();
  assert_(cycleId, 'cycleId is required');

  var products = getCycleProducts_(cycleId);
  var orders = readSheetObjects_(APP.SHEETS.ORDERS).filter(function(o) {
    return o.cycle_id === cycleId;
  });
  var members = readSheetObjects_(APP.SHEETS.MEMBERS);

  var productMap = {};
  products.forEach(function(p) { productMap[p.product_id] = p; });
  var memberMap = {};
  members.forEach(function(m) { memberMap[m.member_id] = m.full_name; });

  var byProduct = {};
  var byMember = {};

  orders.forEach(function(o) {
    var prd = productMap[o.product_id] || { name: 'Unknown', variant: '', format: '' };
    var key = o.product_id;
    if (!byProduct[key]) {
      byProduct[key] = {
        product_id: key,
        name: prd.name,
        variant: prd.variant,
        format: prd.format,
        unit_price: toNumber_(o.unit_price_snapshot),
        total_quantity: 0,
        total_amount: 0
      };
    }
    byProduct[key].total_quantity += toNumber_(o.quantity);
    byProduct[key].total_amount += toNumber_(o.line_total);

    var memberId = o.member_id;
    if (!byMember[memberId]) {
      byMember[memberId] = {
        member_id: memberId,
        full_name: memberMap[memberId] || memberId,
        total_amount: 0
      };
    }
    byMember[memberId].total_amount += toNumber_(o.line_total);
  });

  return {
    by_product: Object.keys(byProduct).map(function(k) {
      byProduct[k].total_amount = Number(byProduct[k].total_amount.toFixed(2));
      return byProduct[k];
    }),
    by_member: Object.keys(byMember).map(function(k) {
      byMember[k].total_amount = Number(byMember[k].total_amount.toFixed(2));
      return byMember[k];
    })
  };
}

function adminUpsertMember(payload) {
  var session = requireAdmin_();
  assert_(payload && payload.full_name, 'full_name is required');
  var email = normalizeEmail_(payload.email);
  assert_(email, 'email is required');
  var role = payload.role || APP.ROLE.MEMBER;
  assert_(role === APP.ROLE.MEMBER || role === APP.ROLE.ADMIN, 'invalid role');

  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  var existing = members.find(function(m) {
    return normalizeEmail_(m.email) === email;
  });

  if (existing) {
    existing.full_name = payload.full_name;
    existing.role = role;
    existing.active = payload.active === false ? false : true;
    existing.updated_at = nowIso_();
  } else {
    members.push({
      member_id: generateId_('mem'),
      full_name: payload.full_name,
      email: email,
      role: role,
      active: payload.active === false ? false : true,
      created_at: nowIso_(),
      updated_at: nowIso_()
    });
  }

  overwriteSheetObjects_(APP.SHEETS.MEMBERS, APP.HEADERS.members, members);
  logAudit_(session, 'admin_upsert_member', 'member', email, payload);
  return { ok: true };
}
