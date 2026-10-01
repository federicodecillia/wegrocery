import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { OrderSnapshot } from "@/lib/payments/order-payment";

export const members = pgTable(
  "members",
  {
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
    // Set at every new session (drizzle/0022_auth_sessions.sql); NULL = never
    // signed in since the email link arrived.
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // Login keys are unique ignoring case (drizzle/0017_member_email_unique.sql).
    // An address used as one member's email and another's alias is rejected
    // by adminUpsertMember (lib/member-email.ts), not by an index.
    uniqueIndex("members_email_lower_uniq").on(sql`lower(${table.email})`),
    uniqueIndex("members_alias_email_lower_uniq")
      .on(sql`lower(${table.aliasEmail})`)
      .where(sql`${table.aliasEmail} IS NOT NULL`),
  ],
);

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
  // The group's payment mode when the cycle was created, fixed for its life
  // (drizzle/0021_pay_per_order.sql): 'wallet' | 'per_order'.
  paymentMode: text("payment_mode").notNull().default("wallet"),
  // The "handling and order preparation" share of a 'per_order' cycle:
  // 'percent' of the products or a 'fixed' amount. NULL on wallet cycles.
  handlingFeeType: text("handling_fee_type"),
  handlingFeeValue: numeric("handling_fee_value", { precision: 10, scale: 2 }),
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

export type DraftLine = { productId: string; quantity: number };

// The member's unconfirmed edits to an open cycle's order, saved while they
// type (drizzle/0019_payment_settings_and_drafts.sql). saveOrder and the cycle
// close delete them in their own batch; lib/order-draft.ts has the rules.
export const orderDrafts = pgTable(
  "order_drafts",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => members.memberId, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => orderCycles.cycleId, { onDelete: "cascade" }),
    lines: jsonb("lines").$type<DraftLine[]>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.cycleId] }),
    index("order_drafts_cycle_id_idx").on(table.cycleId),
    check("order_drafts_lines_array", sql`jsonb_typeof(${table.lines}) = 'array'`),
  ],
);

// Online top-ups (Stripe Checkout), drizzle/0016_stripe_payments.sql.
// status: pending -> succeeded | failed | expired, guarded UPDATEs in
// lib/payments/webhook.ts; succeeded <-> partially_refunded | refunded,
// following refunded_cents = the sum of its pending or succeeded refunds,
// moved by lib/payments/refund-store.ts together with the refund's ledger
// row. A replayed webhook changes nothing.
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
    // drizzle/0021_pay_per_order.sql. 'topup' | 'order' | 'balance'; an
    // 'order' payment confirms the order of cycle_id and carries what it
    // charged for (OrderSnapshot, lib/payments/order-payment.ts).
    kind: text("kind").notNull().default("topup"),
    cycleId: text("cycle_id").references(() => orderCycles.cycleId),
    orderSnapshot: jsonb("order_snapshot").$type<OrderSnapshot>(),
  },
  (table) => [
    index("payments_member_id_idx").on(table.memberId),
    index("payments_member_cycle_idx").on(table.memberId, table.cycleId),
    check("payments_kind_check", sql`${table.kind} IN ('topup', 'order', 'balance')`),
    check(
      "payments_order_complete_check",
      sql`${table.kind} <> 'order' OR (${table.cycleId} IS NOT NULL AND ${table.orderSnapshot} IS NOT NULL)`,
    ),
  ],
);

// Stripe refunds (drizzle/0020_stripe_refunds.sql), one row per refund of a
// payment. Written only by upsertStripeRefund (lib/payments/refund-store.ts):
// status requested -> pending | succeeded -> failed | canceled through guarded
// writes, so a replayed or out-of-order webhook changes nothing.
export const refunds = pgTable(
  "refunds",
  {
    refundId: text("refund_id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.paymentId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.memberId),
    cycleId: text("cycle_id").references(() => orderCycles.cycleId),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    stripeRefundId: text("stripe_refund_id").unique(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("refunds_payment_id_idx").on(table.paymentId),
    check("refunds_amount_positive", sql`${table.amountCents} > 0`),
    check(
      "refunds_status_check",
      sql`${table.status} IN ('requested', 'pending', 'succeeded', 'failed', 'canceled')`,
    ),
    check(
      "refunds_reason_check",
      sql`${table.reason} IN ('settlement', 'order_cancelled', 'late_payment', 'dashboard')`,
    ),
  ],
);

// Payment settings chosen by the admins in Impostazioni
// (drizzle/0019_payment_settings_and_drafts.sql). At most one row, id = 1; no
// row = the brand defaults. Read it through getPaymentSettings
// (lib/payments/get-settings.ts), never directly.
export const appSettings = pgTable(
  "app_settings",
  {
    id: integer("id").primaryKey(),
    // 'wallet' | 'per_order'; always 'wallet' until pay-per-order ships (B2).
    paymentMode: text("payment_mode").notNull().default("wallet"),
    // Credit limit (<= 0) and online top-up ceiling (>= 0); NULL = no limit.
    minBalance: numeric("min_balance", { precision: 10, scale: 2 }),
    maxBalance: numeric("max_balance", { precision: 10, scale: 2 }),
    bankTransferEnabled: boolean("bank_transfer_enabled").notNull(),
    bankHolder: text("bank_holder"),
    bankIban: text("bank_iban"),
    onlinePaymentsEnabled: boolean("online_payments_enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    check("app_settings_single_row", sql`${table.id} = 1`),
    check("app_settings_payment_mode_check", sql`${table.paymentMode} IN ('wallet', 'per_order')`),
    check("app_settings_min_balance_check", sql`${table.minBalance} <= 0`),
    check(
      "app_settings_max_balance_check",
      sql`${table.maxBalance} >= 0 AND ${table.maxBalance} <> 'NaN'`,
    ),
    check("app_settings_balance_range_check", sql`${table.minBalance} <= ${table.maxBalance}`),
    check(
      "app_settings_bank_complete_check",
      sql`NOT ${table.bankTransferEnabled} OR (${table.bankHolder} IS NOT NULL AND ${table.bankIban} IS NOT NULL)`,
    ),
    check(
      "app_settings_wallet_channel_check",
      sql`${table.paymentMode} <> 'wallet' OR ${table.bankTransferEnabled} OR ${table.onlinePaymentsEnabled}`,
    ),
    check(
      "app_settings_per_order_online_check",
      sql`${table.paymentMode} <> 'per_order' OR ${table.onlinePaymentsEnabled}`,
    ),
  ],
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
    // How a manual top-up or payout moved (migration 0018): one of
    // MANUAL_PAYMENT_METHODS in lib/ledger.ts. NULL on online rows (they have
    // a payment_id) and on rows that move no money.
    method: text("method"),
    // Bank reference (CRO/TRN) of a manual movement, NULL when none.
    externalRef: text("external_ref"),
    // The refund this row debits or reverses (migration 0020), NULL otherwise.
    refundId: text("refund_id").references(() => refunds.refundId),
    // Append-only corrections (drizzle/0023_ledger_append_only.sql): the
    // 'reversal' row cancelling this one; on a reversal, the row it cancels;
    // on a correcting row, the row it replaces. lib/ledger-reversal.ts writes them.
    reversedBy: text("reversed_by"),
    reverses: text("reverses"),
    replaces: text("replaces"),
  },
  (table) => [
    index("ledger_entries_member_id_idx").on(table.memberId),
    index("ledger_entries_cycle_id_idx").on(table.cycleId),
    // A NaN amount makes the member's balance NaN forever
    // (drizzle/0012_ledger_amount_checks.sql).
    check("ledger_entries_amount_not_nan", sql`${table.amount} <> 'NaN'`),
    // At most one order/shipping charge per member per cycle: the backstop
    // against double charging (drizzle/0013_unique_cycle_charges.sql).
    uniqueIndex("ledger_entries_cycle_member_charge_live_uniq")
      .on(table.cycleId, table.memberId, table.type)
      .where(sql`${table.type} IN ('order_charge', 'shipping_charge') AND ${table.reversedBy} IS NULL`),
    uniqueIndex("ledger_entries_reverses_uniq").on(table.reverses).where(sql`${table.reverses} IS NOT NULL`),
    check("ledger_entries_reversal_check", sql`(${table.type} = 'reversal') = (${table.reverses} IS NOT NULL)`),
    // A payment is credited at most once (drizzle/0016_stripe_payments.sql).
    uniqueIndex("ledger_entries_payment_topup_uniq")
      .on(table.paymentId)
      .where(sql`${table.type} = 'topup'`),
    // drizzle/0018_ledger_method_external_ref.sql. A NULL method or reference
    // passes both CHECKs.
    check(
      "ledger_entries_method_check",
      sql`${table.method} IN ('bonifico', 'contanti', 'satispay', 'altro')`,
    ),
    check("ledger_entries_external_ref_not_blank", sql`trim(${table.externalRef}) <> ''`),
    // The same bank transfer cannot be recorded twice, whatever the case or
    // the surrounding spaces of its reference.
    uniqueIndex("ledger_entries_external_ref_uniq")
      .on(sql`upper(trim(${table.externalRef}))`)
      .where(sql`${table.externalRef} IS NOT NULL`),
    // An order or balance payment is credited at most once per cycle
    // (drizzle/0021_pay_per_order.sql).
    uniqueIndex("ledger_entries_payment_cycle_credit_uniq")
      .on(table.paymentId, sql`coalesce(${table.cycleId}, '')`)
      .where(sql`${table.type} IN ('order_payment', 'balance_payment')`),
    // One debit and at most one reversal per refund (drizzle/0020_stripe_refunds.sql).
    uniqueIndex("ledger_entries_refund_type_uniq")
      .on(table.refundId, table.type)
      .where(sql`${table.refundId} IS NOT NULL`),
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

// ── Sign-in (Better Auth, drizzle/0022_auth_sessions.sql) ────────────────────
// Written only by Better Auth (lib/auth/config.ts). An auth user is a sign-in
// identity (an email); the member is found by email or alias on every request.

export const authUsers = pgTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("auth_users_email_lower_uniq").on(sql`lower(${table.email})`)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("auth_accounts_user_id_idx").on(table.userId)],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const authRateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

