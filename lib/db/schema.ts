import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  memberId: text("member_id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  aliasEmail: text("alias_email"),
  // 'admin' | 'attivi' | 'utenti' (CHECK since migration 0015). Read it through
  // normalizeRole (lib/roles.ts), which also maps the pre-0015 values.
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  // Last WallyFor membership-card check (migration 0014): 'valid' | 'invalid',
  // NULL = never checked (always NULL on deploys without WALLYFOR_* env).
  membershipStatus: text("membership_status"),
  membershipVerifiedAt: timestamp("membership_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const suppliers = pgTable("suppliers", {
  supplierId: text("supplier_id").primaryKey(),
  name: text("name").notNull(),
  macroCategory: text("macro_category"),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const orderCycles = pgTable("order_cycles", {
  cycleId: text("cycle_id").primaryKey(),
  title: text("title").notNull(),
  pickupDate: timestamp("pickup_date", { withTimezone: true }),
  pickupEndTime: text("pickup_end_time"),
  pickup2Date: timestamp("pickup_2_date", { withTimezone: true }),
  pickup2EndTime: text("pickup_2_end_time"),
  shippingCostPerMember: numeric("shipping_cost_per_member", { precision: 10, scale: 2 }),
  shippingMode: text("shipping_mode").notNull().default("fixed_per_member"),
  shippingTotal: numeric("shipping_total", { precision: 10, scale: 2 }),
  orderOpenAt: timestamp("order_open_at", { withTimezone: true }),
  orderCloseAt: timestamp("order_close_at", { withTimezone: true }),
  status: text("status").notNull(),
  // Minimum role that can see the cycle: 'admin' | 'attivi' | 'utenti' (CHECK
  // since migration 0015). Read it through normalizeAccessLevel / canAccessCycle.
  accessLevel: text("access_level").notNull(),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  supplierId: text("supplier_id").references(() => suppliers.supplierId),
});

export const supplierProducts = pgTable("supplier_products", {
  catalogProductId: text("catalog_product_id").primaryKey(),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.supplierId),
  name: text("name").notNull(),
  variant: text("variant"),
  format: text("format"),
  unit: text("unit"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  // Optional reference price-per-kg for weight-based items so members can
  // compare. Distinct from `unitPrice`, which is the price actually charged
  // for one packaged unit.
  pricePerKg: numeric("price_per_kg", { precision: 10, scale: 2 }),
  notes: text("notes"),
  category: text("category"),
  emoji: text("emoji"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const products = pgTable(
  "products",
  {
    productId: text("product_id").primaryKey(),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => orderCycles.cycleId),
    name: text("name").notNull(),
    variant: text("variant"),
    format: text("format"),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    pricePerKg: numeric("price_per_kg", { precision: 10, scale: 2 }),
    unit: text("unit"),
    supplier: text("supplier"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    supplierId: text("supplier_id").references(() => suppliers.supplierId),
    category: text("category"),
    emoji: text("emoji"),
  },
  (table) => [
    index("products_cycle_id_idx").on(table.cycleId),
    // DB-level twin of the app-side dedup in upsertCycleProducts: same
    // identity key (lower/trimmed name|variant|format|unit, NULL ≡ ''),
    // so two concurrent imports can't both pass the SELECT-then-INSERT
    // check and land duplicate rows in the same cycle (issue #65).
    uniqueIndex("products_cycle_identity_uniq").on(
      table.cycleId,
      sql`lower(trim(${table.name}))`,
      sql`lower(trim(coalesce(${table.variant}, '')))`,
      sql`lower(trim(coalesce(${table.format}, '')))`,
      sql`lower(trim(coalesce(${table.unit}, '')))`,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    orderLineId: text("order_line_id").primaryKey(),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => orderCycles.cycleId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.memberId),
    productId: text("product_id")
      .notNull()
      .references(() => products.productId),
    quantity: integer("quantity").notNull(),
    unitPriceSnapshot: numeric("unit_price_snapshot", {
      precision: 10,
      scale: 2,
    }).notNull(),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
    // Recorded after delivery when the weight/quantity differs from what
    // was ordered. NULL = delivered exactly as ordered.
    actualQuantity: numeric("actual_quantity", { precision: 10, scale: 3 }),
    actualLineTotal: numeric("actual_line_total", { precision: 10, scale: 2 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("orders_cycle_id_idx").on(table.cycleId),
    index("orders_member_id_idx").on(table.memberId),
    // saveOrder writes at most one line per (member, cycle, product); this
    // makes the DB reject any future write path that breaks that invariant
    // instead of silently accumulating duplicate lines (issue #65).
    uniqueIndex("orders_member_cycle_product_uniq").on(
      table.memberId,
      table.cycleId,
      table.productId,
    ),
    // numeric accepts 'NaN'; reject it so a bad price can't poison totals
    // (drizzle/0012_ledger_amount_checks.sql).
    check("orders_line_total_not_nan", sql`${table.lineTotal} <> 'NaN'`),
    check("orders_unit_price_snapshot_not_nan", sql`${table.unitPriceSnapshot} <> 'NaN'`),
    check("orders_actual_line_total_not_nan", sql`${table.actualLineTotal} <> 'NaN'`),
  ],
);

// Online top-ups (Stripe Checkout), drizzle/0016_stripe_payments.sql.
// status: pending -> succeeded | failed | expired; succeeded ->
// partially_refunded | refunded. Transitions are guarded UPDATEs in
// lib/payments/webhook.ts, so a replayed webhook changes nothing.
export const payments = pgTable(
  "payments",
  {
    paymentId: text("payment_id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.memberId),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    checkoutSessionId: text("checkout_session_id").unique(),
    paymentIntentId: text("payment_intent_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("payments_member_id_idx").on(table.memberId)],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    entryId: text("entry_id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.memberId),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    cycleId: text("cycle_id").references(() => orderCycles.cycleId),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    updatedBy: text("updated_by"),
    // Set on the credit and refund rows of an online top-up (migration 0016).
    paymentId: text("payment_id").references(() => payments.paymentId),
  },
  (table) => [
    index("ledger_entries_member_id_idx").on(table.memberId),
    index("ledger_entries_cycle_id_idx").on(table.cycleId),
    // A NaN amount makes the member's balance NaN forever
    // (drizzle/0012_ledger_amount_checks.sql).
    check("ledger_entries_amount_not_nan", sql`${table.amount} <> 'NaN'`),
    // At most one order/shipping charge per member per cycle: the backstop
    // against double charging (drizzle/0013_unique_cycle_charges.sql).
    uniqueIndex("ledger_entries_cycle_member_charge_uniq")
      .on(table.cycleId, table.memberId, table.type)
      .where(sql`${table.type} IN ('order_charge', 'shipping_charge')`),
    // A payment is credited at most once (drizzle/0016_stripe_payments.sql).
    uniqueIndex("ledger_entries_payment_topup_uniq")
      .on(table.paymentId)
      .where(sql`${table.type} = 'topup'`),
  ],
);

export const auditLog = pgTable("audit_log", {
  auditId: text("audit_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  payloadJson: text("payload_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    notificationId: text("notification_id").primaryKey(),
    memberId: text("member_id").references(() => members.memberId),
    role: text("role"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("notifications_member_id_idx").on(table.memberId),
    index("notifications_role_idx").on(table.role),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
);

// Per-member, per-category notification channel preferences. Sparse: a missing
// row means "use the default from lib/notifications/categories.ts". `category`
// holds a NotificationCategory value; app/email gate the two delivery channels.
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => members.memberId, { onDelete: "cascade" }),
    category: text("category").notNull(),
    appEnabled: boolean("app_enabled").notNull(),
    emailEnabled: boolean("email_enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.category] })],
);
