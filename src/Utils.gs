function nowIso_() {
  return new Date().toISOString();
}

function generateId_(prefix) {
  return [prefix, Utilities.getUuid().slice(0, 8), Date.now()].join('_');
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  var n = Number(value);
  return isNaN(n) ? 0 : n;
}

function assert_(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
