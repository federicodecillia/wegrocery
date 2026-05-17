import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  memberId: text("member_id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  aliasEmail: text("alias_email"),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
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
  (table) => [index("products_cycle_id_idx").on(table.cycleId)],
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
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("orders_cycle_id_idx").on(table.cycleId),
    index("orders_member_id_idx").on(table.memberId),
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
  },
  (table) => [
    index("ledger_entries_member_id_idx").on(table.memberId),
    index("ledger_entries_cycle_id_idx").on(table.cycleId),
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
