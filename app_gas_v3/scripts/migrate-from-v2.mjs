import fs from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const members = pgTable("members", {
  memberId: text("member_id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  active: boolean("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

const suppliers = pgTable("suppliers", {
  supplierId: text("supplier_id").primaryKey(),
  name: text("name").notNull(),
  macroCategory: text("macro_category"),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

const orderCycles = pgTable("order_cycles", {
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
  supplierId: text("supplier_id"),
});

const products = pgTable("products", {
  productId: text("product_id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  name: text("name").notNull(),
  variant: text("variant"),
  format: text("format"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull(),
  active: boolean("active").notNull(),
  supplierId: text("supplier_id"),
  category: text("category"),
});

const orders = pgTable("orders", {
  orderLineId: text("order_line_id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  memberId: text("member_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceSnapshot: numeric("unit_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

const ledgerEntries = pgTable("ledger_entries", {
  entryId: text("entry_id").primaryKey(),
  memberId: text("member_id").notNull(),
  entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  cycleId: text("cycle_id"),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
});

const auditLog = pgTable("audit_log", {
  auditId: text("audit_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  payloadJson: text("payload_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

function assertEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function toBool(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toNumeric(value, fallback = "0.00") {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed.toFixed(2);
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
}

async function readExportPayload() {
  const filePath = process.env.V2_EXPORT_FILE;
  const url = process.env.V2_EXPORT_URL;

  if (!filePath && !url) {
    throw new Error("Set V2_EXPORT_FILE or V2_EXPORT_URL");
  }

  if (filePath) {
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    const raw = await fs.readFile(absolute, "utf8");
    return JSON.parse(raw);
  }

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch V2 export: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function mapTables(payload) {
  const tables = payload?.tables;
  if (!tables) throw new Error("Invalid export: missing 'tables'");

  const mappedMembers = (tables.members ?? []).map((row) => ({
    memberId: String(row.member_id),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? "").trim().toLowerCase(),
    role: String(row.role ?? "member"),
    active: toBool(row.active, true),
    createdAt: toDate(row.created_at, new Date()),
    updatedAt: toDate(row.updated_at, new Date()),
  }));

  const mappedSuppliers = (tables.suppliers ?? []).map((row) => ({
    supplierId: String(row.supplier_id),
    name: String(row.name ?? ""),
    macroCategory: row.macro_category ? String(row.macro_category) : null,
    contactName: row.contact_name ? String(row.contact_name) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    address: row.address ? String(row.address) : null,
    notes: row.notes ? String(row.notes) : null,
    active: toBool(row.active, true),
    createdAt: toDate(row.created_at, new Date()),
  }));

  const mappedOrderCycles = (tables.order_cycles ?? []).map((row) => ({
    cycleId: String(row.cycle_id),
    title: String(row.title ?? ""),
    pickupDate: toDate(row.pickup_date),
    orderOpenAt: toDate(row.order_open_at),
    orderCloseAt: toDate(row.order_close_at),
    status: String(row.status ?? "draft"),
    accessLevel: String(row.access_level ?? "all"),
    notes: row.notes ? String(row.notes) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: toDate(row.created_at, new Date()),
    closedAt: toDate(row.closed_at),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
  }));

  const mappedProducts = (tables.products ?? []).map((row) => ({
    productId: String(row.product_id),
    cycleId: String(row.cycle_id),
    name: String(row.name ?? ""),
    variant: row.variant ? String(row.variant) : null,
    format: row.format ? String(row.format) : null,
    unitPrice: toNumeric(row.unit_price),
    supplier: row.supplier ? String(row.supplier) : null,
    notes: row.notes ? String(row.notes) : null,
    sortOrder: toInt(row.sort_order, 0),
    active: toBool(row.active, true),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    category: row.category ? String(row.category) : null,
  }));

  const mappedOrders = (tables.orders ?? []).map((row) => ({
    orderLineId: String(row.order_line_id),
    cycleId: String(row.cycle_id),
    memberId: String(row.member_id),
    productId: String(row.product_id),
    quantity: toInt(row.quantity, 0),
    unitPriceSnapshot: toNumeric(row.unit_price_snapshot),
    lineTotal: toNumeric(row.line_total),
    updatedAt: toDate(row.updated_at, new Date()),
  }));

  const mappedLedgerEntries = (tables.ledger_entries ?? []).map((row) => ({
    entryId: String(row.entry_id),
    memberId: String(row.member_id),
    entryDate: toDate(row.entry_date, new Date()),
    type: String(row.type ?? "adjustment"),
    amount: toNumeric(row.amount),
    cycleId: row.cycle_id ? String(row.cycle_id) : null,
    note: row.note ? String(row.note) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: toDate(row.created_at, new Date()),
    updatedAt: toDate(row.updated_at),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
  }));

  const mappedAuditLog = (tables.audit_log ?? []).map((row) => ({
    auditId: String(row.audit_id),
    userEmail: String(row.user_email ?? ""),
    action: String(row.action ?? ""),
    entityType: String(row.entity_type ?? ""),
    entityId: row.entity_id ? String(row.entity_id) : null,
    payloadJson:
      row.payload_json === null || row.payload_json === undefined
        ? null
        : String(row.payload_json),
    createdAt: toDate(row.created_at, new Date()),
  }));

  return {
    members: mappedMembers,
    suppliers: mappedSuppliers,
    orderCycles: mappedOrderCycles,
    products: mappedProducts,
    orders: mappedOrders,
    ledgerEntries: mappedLedgerEntries,
    auditLog: mappedAuditLog,
  };
}

async function main() {
  const databaseUrl = assertEnv("DATABASE_URL");
  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient);

  const payload = await readExportPayload();
  const data = mapTables(payload);

  await db.execute(sql`
    TRUNCATE TABLE
      orders,
      products,
      ledger_entries,
      audit_log,
      order_cycles,
      suppliers,
      members
    CASCADE
  `);

  if (data.members.length) await db.insert(members).values(data.members);
  if (data.suppliers.length) await db.insert(suppliers).values(data.suppliers);
  if (data.orderCycles.length) await db.insert(orderCycles).values(data.orderCycles);
  if (data.products.length) await db.insert(products).values(data.products);
  if (data.orders.length) await db.insert(orders).values(data.orders);
  if (data.ledgerEntries.length) await db.insert(ledgerEntries).values(data.ledgerEntries);
  if (data.auditLog.length) await db.insert(auditLog).values(data.auditLog);

  console.log("Migration completed.");
  console.table({
    members: data.members.length,
    suppliers: data.suppliers.length,
    order_cycles: data.orderCycles.length,
    products: data.products.length,
    orders: data.orders.length,
    ledger_entries: data.ledgerEntries.length,
    audit_log: data.auditLog.length,
  });
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
