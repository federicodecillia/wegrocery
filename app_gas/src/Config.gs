/* ───────────────────────────────────────────
   Config.gs — Costanti, schema sheet, enum
   ─────────────────────────────────────────── */

var APP = {

  SHEETS: {
    MEMBERS:        'members',
    ORDER_CYCLES:   'order_cycles',
    PRODUCTS:       'products',
    ORDERS:         'orders',
    LEDGER_ENTRIES: 'ledger_entries',
    AUDIT_LOG:      'audit_log'
  },

  HEADERS: {
    members:        ['member_id','full_name','email','role','active','created_at','updated_at'],
    order_cycles:   ['cycle_id','title','pickup_date','order_open_at','order_close_at','status','access_level','notes','created_by','created_at','closed_at'],
    products:       ['product_id','cycle_id','name','variant','format','unit_price','supplier','notes','sort_order','active'],
    orders:         ['order_line_id','cycle_id','member_id','product_id','quantity','unit_price_snapshot','line_total','updated_at'],
    ledger_entries: ['entry_id','member_id','entry_date','type','amount','cycle_id','note','created_by','created_at'],
    audit_log:      ['audit_id','user_email','action','entity_type','entity_id','payload_json','created_at']
  },

  ROLE: {
    ADMIN:  'admin',
    ATTIVO: 'attivo',
    SOCIO:  'socio',
    MEMBER: 'member'   // Legacy pre-v2 — equivale a ATTIVO
  },

  ACCESS_LEVEL: {
    ATTIVI: 'attivi',  // Solo admin + attivi
    ALL:    'all'      // Admin + attivi + soci
  },

  CYCLE_STATUS: {
    DRAFT:    'draft',
    OPEN:     'open',
    CLOSED:   'closed',
    ARCHIVED: 'archived'
  },

  LEDGER_TYPE: {
    TOPUP:        'topup',
    ORDER_CHARGE: 'order_charge',
    ADJUSTMENT:   'adjustment'
  },

  PROP_DATA_SPREADSHEET_ID: 'DATA_SPREADSHEET_ID'
};
