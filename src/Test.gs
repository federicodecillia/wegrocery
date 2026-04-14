function runSmokeTests() {
  var session = getCurrentSession();
  assert_(session.email, 'Session email missing');
  assert_(session.member_id, 'Session member_id missing');

  var balances = [];
  if (session.role === APP.ROLE.ADMIN) {
    balances = adminGetBalances();
    assert_(Array.isArray(balances), 'adminGetBalances must return array');
  }

  var dashboard = getMemberDashboard();
  assert_(dashboard.session.member_id === session.member_id, 'Dashboard session mismatch');
  assert_(typeof dashboard.my_balance === 'number', 'Balance must be number');

  return {
    ok: true,
    role: session.role,
    balances_count: balances.length,
    open_cycle: dashboard.open_cycle ? dashboard.open_cycle.cycle_id : null
  };
}
