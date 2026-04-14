/* ───────────────────────────────────────────
   Utils.gs — Helper functions
   ─────────────────────────────────────────── */

function nowIso_() {
  return new Date().toISOString();
}

function generateId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

function assert_(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function normalizeEmail_(email) {
  return (email || '').toString().trim().toLowerCase();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function toNumber_(val) {
  var n = Number(val);
  return isNaN(n) ? 0 : n;
}

function formatDate_(isoString) {
  if (!isoString) return '';
  var d = new Date(isoString);
  var dd = ('0' + d.getDate()).slice(-2);
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  var yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}
