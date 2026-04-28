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

export const products = pgTable("products", {
  productId: text("product_id").primaryKey(),
  cycleId: text("cycle_id")
    .notNull()
    .references(() => orderCycles.cycleId),
  name: text("name").notNull(),
  variant: text("variant"),
  format: text("format"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  supplierId: text("supplier_id").references(() => suppliers.supplierId),
  category: text("category"),
});

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
  (table) => [index("ledger_entries_member_id_idx").on(table.memberId)],
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
