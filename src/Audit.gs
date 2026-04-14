function logAudit_(session, action, entityType, entityId, payload) {
  appendSheetObject_(APP.SHEETS.AUDIT_LOG, APP.HEADERS.audit_log, {
    audit_id: generateId_('aud'),
    user_email: session.email,
    action: action,
    entity_type: entityType,
    entity_id: entityId || '',
    payload_json: JSON.stringify(payload || {}),
    created_at: nowIso_()
  });
}
