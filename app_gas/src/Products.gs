/* ───────────────────────────────────────────
   Products.gs — Gestione prodotti per ciclo
   ─────────────────────────────────────────── */

function getCycleProducts_(cycleId) {
  return readSheetObjectsWhere_(APP.SHEETS.PRODUCTS, 'cycle_id', cycleId)
    .filter(function(p) { return String(p.active) !== 'false'; })
    .sort(function(a, b) { return toNumber_(a.sort_order) - toNumber_(b.sort_order); });
}

function adminUpdateProducts(payload) {
  var admin = requireAdmin_(payload);
  assert_(payload.cycle_id, 'cycle_id obbligatorio.');
  assert_(payload.products && payload.products.length, 'Lista prodotti vuota.');

  var allProducts = readSheetObjects_(APP.SHEETS.PRODUCTS);

  // Rimuovi i prodotti esistenti per questo ciclo
  var others = allProducts.filter(function(p) {
    return p.cycle_id !== payload.cycle_id;
  });

  // Crea nuovi
  var now = nowIso_();
  var newProducts = payload.products.map(function(p, idx) {
    return {
      product_id: p.product_id || generateId_('prd'),
      cycle_id:   payload.cycle_id,
      name:       (p.name || '').trim(),
      variant:    (p.variant || '').trim(),
      format:     (p.format || '').trim(),
      unit_price: toNumber_(p.unit_price),
      supplier:   (p.supplier || '').trim(),
      notes:      (p.notes || '').trim(),
      sort_order: idx + 1,
      active:     true
    };
  });

  overwriteSheetObjects_(APP.SHEETS.PRODUCTS, APP.HEADERS.products, others.concat(newProducts));
  logAudit_(admin.email, 'update_products', 'cycle', payload.cycle_id,
    { count: newProducts.length });
  return { count: newProducts.length };
}

function adminDuplicateProducts(payload) {
  var admin = requireAdmin_(payload);
  assert_(payload.source_cycle_id, 'source_cycle_id obbligatorio.');
  assert_(payload.target_cycle_id, 'target_cycle_id obbligatorio.');

  var sourceProducts = readSheetObjectsWhere_(APP.SHEETS.PRODUCTS, 'cycle_id', payload.source_cycle_id);
  assert_(sourceProducts.length, 'Nessun prodotto trovato nel ciclo sorgente.');

  var newProducts = sourceProducts.map(function(p, idx) {
    return {
      product_id: generateId_('prd'),
      cycle_id:   payload.target_cycle_id,
      name:       p.name,
      variant:    p.variant,
      format:     p.format,
      unit_price: p.unit_price,
      supplier:   p.supplier,
      notes:      p.notes,
      sort_order: idx + 1,
      active:     true
    };
  });

  appendSheetObjects_(APP.SHEETS.PRODUCTS, APP.HEADERS.products, newProducts);
  logAudit_(admin.email, 'duplicate_products', 'cycle', payload.target_cycle_id,
    { source: payload.source_cycle_id, count: newProducts.length });
  return { count: newProducts.length };
}
