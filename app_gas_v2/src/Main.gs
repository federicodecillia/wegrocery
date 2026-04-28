/* ───────────────────────────────────────────
   Main.gs — Entry point & API dispatcher
   ─────────────────────────────────────────── */

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'exportAll') {
    return exportAllAsJson_(e.parameter);
  }

  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Porta Moneta GAS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function exportAllAsJson_(params) {
  var admin = requireAdmin_({});

  var payload = {
    exported_at: nowIso_(),
    exported_by: admin.email,
    tables: {
      members: readSheetObjects_(APP.SHEETS.MEMBERS),
      suppliers: readSheetObjects_(APP.SHEETS.SUPPLIERS),
      catalog_products: readSheetObjects_(APP.SHEETS.CATALOG_PRODUCTS),
      order_cycles: readSheetObjects_(APP.SHEETS.ORDER_CYCLES),
      products: readSheetObjects_(APP.SHEETS.PRODUCTS),
      orders: readSheetObjects_(APP.SHEETS.ORDERS),
      ledger_entries: readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES),
      audit_log: readSheetObjects_(APP.SHEETS.AUDIT_LOG)
    }
  };

  if (params && params.pretty === '1') {
    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function callApi(action, payload) {
  try {
    var handlers = {
      // Session
      getCurrentSession:    getCurrentSession,
      getOpenCycle:         getOpenCycle,

      // Member
      getMemberDashboard:   getMemberDashboard,
      saveMyOrder:          saveMyOrder,
      getMyOrderHistory:    getMyOrderHistory,
      getMyOrderDetail:     getMyOrderDetail,
      getMyLedger:          getMyLedger,

      // Admin — Ordini (ex-Cicli)
      adminCreateCycle:     adminCreateCycle,
      adminCloseCycle:      adminCloseCycle,
      adminUpdateCycle:     adminUpdateCycle,
      adminGetCycles:       adminGetCycles,
      adminGetRecentCycles: adminGetRecentCycles,
      adminGetCycleSummary: adminGetCycleSummary,

      // Admin — Prodotti ciclo (snapshot)
      adminUpdateProducts:    adminUpdateProducts,
      adminDuplicateProducts: adminDuplicateProducts,

      // Admin — Cassa (ex-Bonifici)
      adminRecordTopup:       adminRecordTopup,
      adminGetBalances:       adminGetBalances,
      adminGetMemberLedger:   adminGetMemberLedger,
      adminUpdateLedgerEntry: adminUpdateLedgerEntry,
      adminDeleteLedgerEntry: adminDeleteLedgerEntry,

      // Admin — Soci
      adminGetMembers:      adminGetMembers,
      adminUpsertMember:    adminUpsertMember,

      // Admin — Fornitori e catalogo
      adminGetSuppliers:               adminGetSuppliers,
      adminUpsertSupplier:             adminUpsertSupplier,
      adminDeleteSupplier:             adminDeleteSupplier,
      adminGetCatalog:                 adminGetCatalog,
      adminUpsertCatalogProduct:       adminUpsertCatalogProduct,
      adminDeleteCatalogProduct:       adminDeleteCatalogProduct,
      adminLoadCatalogIntoCycle:       adminLoadCatalogIntoCycle,
      adminGetAllCatalog:              adminGetAllCatalog,
      adminBulkReplaceSupplierCatalog: adminBulkReplaceSupplierCatalog,
      adminGetCycleCatalogSelection:   adminGetCycleCatalogSelection,
      adminSetCycleCatalogSelection:   adminSetCycleCatalogSelection,

      // Setup
      setupDataStore:       setupDataStore,
      setupMissingSheets:   setupMissingSheets,
      setDataSpreadsheetId: function(p) { return setDataSpreadsheetId(p.id); }
    };

    var fn = handlers[action];
    assert_(fn, 'Azione sconosciuta: ' + action);

    var result = fn(payload || {});
    return { ok: true, result: result };
  } catch (error) {
    return {
      ok: false,
      error: { message: error.message || String(error) }
    };
  }
}

/* ── Admin: Riepilogo ciclo ── */

function adminGetCycleSummary(payload) {
  var admin = requireAdmin_(payload);
  assert_(payload.cycle_id, 'cycle_id obbligatorio.');

  var orders   = readSheetObjectsWhere_(APP.SHEETS.ORDERS, 'cycle_id', payload.cycle_id);
  var products = readSheetObjectsWhere_(APP.SHEETS.PRODUCTS, 'cycle_id', payload.cycle_id);
  var members  = readSheetObjects_(APP.SHEETS.MEMBERS);

  var productMap = {};
  products.forEach(function(p) { productMap[p.product_id] = p; });
  var memberMap = {};
  members.forEach(function(m) { memberMap[m.member_id] = m; });

  // Per prodotto
  var byProduct = {};
  orders.forEach(function(o) {
    var pid = o.product_id;
    if (!byProduct[pid]) {
      var p = productMap[pid] || {};
      byProduct[pid] = {
        product_id: pid,
        name: p.name || '?',
        variant: p.variant || '',
        format: p.format || '',
        unit_price: toNumber_(p.unit_price),
        total_qty: 0,
        total_amount: 0
      };
    }
    byProduct[pid].total_qty += toNumber_(o.quantity);
    byProduct[pid].total_amount += toNumber_(o.line_total);
  });

  // Per socio
  var byMember = {};
  orders.forEach(function(o) {
    var mid = o.member_id;
    if (!byMember[mid]) {
      var m = memberMap[mid] || {};
      byMember[mid] = { member_id: mid, full_name: m.full_name || '?', total: 0, lines: [] };
    }
    var p = productMap[o.product_id] || {};
    byMember[mid].total += toNumber_(o.line_total);
    byMember[mid].lines.push({
      product_name: p.name || '?',
      variant: p.variant || '',
      quantity: toNumber_(o.quantity),
      line_total: toNumber_(o.line_total)
    });
  });

  var productList = Object.keys(byProduct).map(function(k) { return byProduct[k]; });
  var memberList  = Object.keys(byMember).map(function(k) {
    byMember[k].total = Math.round(byMember[k].total * 100) / 100;
    return byMember[k];
  });

  productList.sort(function(a, b) { return a.name.localeCompare(b.name); });
  memberList.sort(function(a, b) { return a.full_name.localeCompare(b.full_name); });

  var grandTotal = 0;
  memberList.forEach(function(m) { grandTotal += m.total; });

  return {
    by_product:  productList,
    by_member:   memberList,
    grand_total: Math.round(grandTotal * 100) / 100,
    order_count: Object.keys(byMember).length
  };
}
