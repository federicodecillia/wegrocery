/* ───────────────────────────────────────────
   Auth.gs — Session & authorization
   ─────────────────────────────────────────── */

function getSessionEmail_() {
  var email = Session.getActiveUser().getEmail();
  assert_(email, 'Impossibile determinare l\'utente. Verifica di aver effettuato il login.');
  return normalizeEmail_(email);
}

function getMemberByEmail_(email) {
  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  var normalized = normalizeEmail_(email);
  for (var i = 0; i < members.length; i++) {
    if (normalizeEmail_(members[i].email) === normalized) {
      return members[i];
    }
  }
  return null;
}

function requireSession_(payload) {
  var email = getSessionEmail_();
  var member = getMemberByEmail_(email);
  assert_(member, 'Accesso non autorizzato. L\'email ' + email + ' non è registrata come socio.');
  assert_(String(member.active) === 'true' || member.active === true,
    'Il tuo account è disattivato. Contatta un amministratore.');
  return member;
}

function requireAdmin_(payload) {
  var member = requireSession_(payload);
  assert_(member.role === APP.ROLE.ADMIN,
    'Operazione riservata agli amministratori.');
  return member;
}

function getCurrentSession(payload) {
  var member = requireSession_(payload);
  return {
    member_id: member.member_id,
    full_name: member.full_name,
    email:     member.email,
    role:      member.role
  };
}
