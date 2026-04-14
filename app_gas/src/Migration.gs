/* ───────────────────────────────────────────
   Migration.gs — Import dati dal vecchio Sheet
   Eseguire una tantum dall'editor Apps Script
   ─────────────────────────────────────────── */

/**
 * Importa i soci. Aggiornare le email prima di eseguire.
 * Eseguire dall'editor: migrateMembers()
 */
function migrateMembers() {
  var now = nowIso_();

  // ⚠️ AGGIORNARE LE EMAIL PRIMA DEL CUTOVER
  // Impostare role: 'admin' per chi deve amministrare
  var soci = [
    { full_name: 'Di Mauro',         email: 'marilu.dimauro@portamoneta.org',       role: 'member' },
    { full_name: 'Malacrinò',        email: 'maria.malacrino@portamoneta.org',      role: 'admin'  },
    { full_name: 'Miglierina',       email: 'giuliana.miglierina@portamoneta.org',  role: 'member' },
    { full_name: 'Di Simine',        email: 'nadia.disimine@portamoneta.org',       role: 'admin'  },
    { full_name: 'Favalli',          email: 'mattia.favalli@portamoneta.org',       role: 'member' },
    { full_name: 'Riva Cafora',      email: 'chiara.riva@portamoneta.org',          role: 'member' },
    { full_name: 'Eva',              email: 'eva.veroli@portamoneta.org',           role: 'admin'  },
    { full_name: 'Maria Fois',       email: 'maria.fois@portamoneta.org',           role: 'member' },
    { full_name: 'Ballabio',         email: 'silvia.ballabio@portamoneta.org',      role: 'member' },
    { full_name: 'Cucchiara A.',     email: 'alessandra.cucchiara@portamoneta.org', role: 'member' },
    { full_name: 'Rossin-Ravelli',   email: 'francesca.rossin@portamoneta.org',     role: 'member' },
    { full_name: 'De Cillia',        email: 'federico.decillia@portamoneta.org',    role: 'admin'  }
  ];

  var objects = soci.map(function(s) {
    return {
      member_id:  generateId_('mem'),
      full_name:  s.full_name,
      email:      normalizeEmail_(s.email),
      role:       s.role,
      active:     true,
      created_at: now,
      updated_at: now
    };
  });

  appendSheetObjects_(APP.SHEETS.MEMBERS, APP.HEADERS.members, objects);
  Logger.log('Importati ' + objects.length + ' soci.');
  return { imported: objects.length };
}

/**
 * Importa i saldi iniziali dal foglio CASSA (dati aggiornati al 25/03/2026).
 * ⚠️ Aggiornare i saldi al giorno del cutover effettivo se ci sono stati nuovi ordini/bonifici.
 * Eseguire dall'editor: migrateInitialBalances()
 */
function migrateInitialBalances() {
  var now = nowIso_();
  var members = readSheetObjects_(APP.SHEETS.MEMBERS);

  // Mappa cognome → member_id (case-insensitive)
  var nameMap = {};
  members.forEach(function(m) {
    nameMap[m.full_name.toLowerCase().trim()] = m.member_id;
  });

  // Saldi dal foglio CASSA — riga TOTALE (aggiornati al 25/03/2026)
  // ⚠️ VERIFICARE E AGGIORNARE AL GIORNO DEL CUTOVER
  var saldi = [
    { name: 'Di Mauro',        amount:    6.90 },
    { name: 'Malacrinò',       amount:   -5.55 },
    { name: 'Miglierina',      amount:  -34.60 },
    { name: 'Di Simine',       amount:  -11.40 },
    { name: 'Favalli',         amount:  -12.05 },
    { name: 'Riva Cafora',     amount:    4.90 },
    { name: 'Eva',             amount:   -4.00 },
    { name: 'Maria Fois',      amount:  -10.70 },
    { name: 'Ballabio',        amount:    2.20 },
    { name: 'Cucchiara A.',    amount:    0.00 },
    { name: 'Rossin-Ravelli',  amount:   39.25 }
  ];

  var entries = [];
  var warnings = [];

  saldi.forEach(function(s) {
    if (s.amount === 0) return; // Non creare movimenti a zero

    var mid = nameMap[s.name.toLowerCase().trim()];
    if (!mid) {
      warnings.push('ATTENZIONE: socio non trovato per saldo: "' + s.name + '"');
      Logger.log('⚠️ Socio non trovato: ' + s.name);
      return;
    }

    entries.push({
      entry_id:   generateId_('led'),
      member_id:  mid,
      entry_date: now.substring(0, 10),
      type:       APP.LEDGER_TYPE.ADJUSTMENT,
      amount:     s.amount,
      cycle_id:   '',
      note:       'Saldo iniziale da migrazione (al 25/03/2026)',
      created_by: 'migration',
      created_at: now
    });
  });

  if (entries.length) {
    appendSheetObjects_(APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries, entries);
  }

  Logger.log('═══ MIGRAZIONE SALDI ═══');
  Logger.log('Saldi importati: ' + entries.length);
  Logger.log('Saldi a zero (saltati): ' + (saldi.length - entries.length - warnings.length));
  if (warnings.length) {
    Logger.log('Warnings: ' + warnings.length);
    warnings.forEach(function(w) { Logger.log('  ' + w); });
  }
  entries.forEach(function(e) {
    var name = '';
    for (var i = 0; i < saldi.length; i++) {
      var mid = nameMap[saldi[i].name.toLowerCase().trim()];
      if (mid === e.member_id) { name = saldi[i].name; break; }
    }
    Logger.log('  ' + name + ': €' + e.amount);
  });

  return { imported: entries.length, warnings: warnings };
}
