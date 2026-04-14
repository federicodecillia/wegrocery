/* ───────────────────────────────────────────
   Members.gs — Gestione anagrafica soci
   ─────────────────────────────────────────── */

function adminGetMembers(payload) {
  requireAdmin_(payload);
  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  return members.map(function(m) {
    return {
      member_id: m.member_id,
      full_name: m.full_name,
      email:     m.email,
      role:      m.role,
      active:    m.active
    };
  });
}

function adminUpsertMember(payload) {
  var admin = requireAdmin_(payload);
  assert_(payload.full_name, 'Nome obbligatorio.');
  assert_(payload.email, 'Email obbligatoria.');
  var email = normalizeEmail_(payload.email);
  var role = payload.role || APP.ROLE.MEMBER;
  assert_(role === APP.ROLE.MEMBER || role === APP.ROLE.ADMIN, 'Ruolo non valido.');

  var members = readSheetObjects_(APP.SHEETS.MEMBERS);
  var existing = null;
  var existingIndex = -1;

  for (var i = 0; i < members.length; i++) {
    if (normalizeEmail_(members[i].email) === email) {
      existing = members[i];
      existingIndex = i;
      break;
    }
  }

  var now = nowIso_();

  if (existing) {
    members[existingIndex].full_name  = payload.full_name;
    members[existingIndex].role       = role;
    members[existingIndex].active     = payload.active !== undefined ? payload.active : existing.active;
    members[existingIndex].updated_at = now;
  } else {
    members.push({
      member_id:  generateId_('mem'),
      full_name:  payload.full_name,
      email:      email,
      role:       role,
      active:     payload.active !== undefined ? payload.active : true,
      created_at: now,
      updated_at: now
    });
  }

  overwriteSheetObjects_(APP.SHEETS.MEMBERS, APP.HEADERS.members, members);
  logAudit_(admin.email, existing ? 'update_member' : 'create_member', 'member', email, payload);
  return { success: true };
}
