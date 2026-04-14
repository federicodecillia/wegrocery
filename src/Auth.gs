function getCurrentUserEmail_() {
  var email = normalizeEmail_(Session.getActiveUser().getEmail());
  assert_(email, 'Unable to resolve current user email. Check web app deployment access settings.');
  return email;
}

function getMemberByEmail_(email) {
  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  var match = members.find(function(m) {
    return normalizeEmail_(m.email) === normalizeEmail_(email) && String(m.active).toUpperCase() === 'TRUE';
  });
  return match || null;
}

function requireSession_() {
  var email = getCurrentUserEmail_();
  var member = getMemberByEmail_(email);
  assert_(member, 'Access denied: user not registered or inactive.');
  return {
    email: email,
    member_id: member.member_id,
    full_name: member.full_name,
    role: member.role
  };
}

function requireAdmin_() {
  var session = requireSession_();
  assert_(session.role === APP.ROLE.ADMIN, 'Admin role required.');
  return session;
}

function getCurrentSession() {
  return requireSession_();
}
