function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Porta Moneta GAS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function callApi(action, payload) {
  try {
    var handlers = {
      getCurrentSession: getCurrentSession,
      getOpenCycle: getOpenCycle,
      getMemberDashboard: getMemberDashboard,
      saveMyOrder: saveMyOrder,
      getMyOrderHistory: getMyOrderHistory,
      getMyLedger: getMyLedger,
      adminCreateCycle: adminCreateCycle,
      adminUpdateProducts: adminUpdateProducts,
      adminCloseCycle: function(p) { return adminCloseCycle(p.cycle_id); },
      adminRecordTopup: adminRecordTopup,
      adminGetBalances: adminGetBalances,
      adminGetCycleSummary: function(p) { return adminGetCycleSummary(p.cycle_id); },
      adminUpsertMember: adminUpsertMember,
      setupDataStore: setupDataStore,
      seedSampleData: seedSampleData,
      setDataSpreadsheetId: function(p) { return setDataSpreadsheetId(p.id); }
    };

    var fn = handlers[action];
    assert_(fn, 'Unknown action: ' + action);

    var result = fn(payload || {});
    return { ok: true, result: result };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error.message || String(error)
      }
    };
  }
}
