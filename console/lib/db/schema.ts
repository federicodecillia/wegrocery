import { bigserial, boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { InstanceStats } from "@/lib/stats/types";

// Mirrors drizzle/0000_init.sql (the SQL files are the source of truth;
// migrations are applied by scripts/db-migrate.mjs, never by drizzle-kit).

export type HostingModel = "managed" | "group_owned";
export type InstanceStatus = "provisioning" | "live" | "archived";
export type RequestStatus = "new" | "in_progress" | "created" | "discarded";

/** Non-secret wizard state of an instance being provisioned. */
export interface WizardState {
  adminEmail?: string;
  locale?: "it" | "en";
  currency?: string;
  timeZone?: string;
  appName?: string;
  shortName?: string;
  primary?: string | null;
  accent?: string | null;
  logoUrl?: string | null;
  brandJson?: string;
  emailMode?: "group_domain" | "shared_domain";
  emailDomain?: string;
  mailFrom?: string;
  paymentsConfigured?: boolean;
  stripeMode?: "live" | "test";
  deploymentId?: string;
  customDomain?: string;
  handoverSentAt?: string;
}

export const requests = pgTable("requests", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").$type<RequestStatus>().notNull().default("new"),
  groupName: text("group_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  city: text("city"),
  membersEstimate: integer("members_estimate"),
  locale: text("locale").notNull().default("it"),
  currency: text("currency").notNull().default("EUR"),
  timeZone: text("time_zone").notNull().default("Europe/Rome"),
  emailDomain: text("email_domain"),
  dnsManager: text("dns_manager"),
  logoUrl: text("logo_url"),
  colors: text("colors"),
  onlinePayments: boolean("online_payments").notNull().default(false),
  googleLogin: boolean("google_login").notNull().default(false),
  cardCheck: boolean("card_check").notNull().default(false),
  paymentMode: text("payment_mode").$type<"wallet" | "per_order">().notNull().default("wallet"),
  hostingPreference: text("hosting_preference").$type<HostingModel>().notNull().default("managed"),
  notes: text("notes"),
  privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }).notNull(),
  ipHash: text("ip_hash"),
});

export const instances = pgTable("instances", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  hostingModel: text("hosting_model").$type<HostingModel>().notNull().default("managed"),
  vercelTeamId: text("vercel_team_id"),
  vercelTeamSlug: text("vercel_team_slug"),
  vercelProjectId: text("vercel_project_id"),
  neonOrgId: text("neon_org_id"),
  neonProjectId: text("neon_project_id"),
  resendDomainId: text("resend_domain_id"),
  status: text("status").$type<InstanceStatus>().notNull().default("live"),
  statsSecretEnc: text("stats_secret_enc"),
  notes: text("notes"),
  requestId: text("request_id"),
  rolloutOrder: integer("rollout_order").notNull().default(100),
  wizard: jsonb("wizard").$type<WizardState>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const instanceSnapshots = pgTable("instance_snapshots", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  instanceId: text("instance_id").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  healthOk: boolean("health_ok"),
  healthVersion: text("health_version"),
  healthDb: boolean("health_db"),
  stats: jsonb("stats").$type<InstanceStats | null>(),
  error: text("error"),
});

export const provisioningSteps = pgTable(
  "provisioning_steps",
  {
    instanceId: text("instance_id").notNull(),
    step: text("step").notNull(),
    status: text("status").$type<"todo" | "done" | "failed" | "skipped">().notNull().default("todo"),
    detail: text("detail"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.instanceId, t.step] })],
);

export const loginAttempts = pgTable("login_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ipHash: text("ip_hash").notNull(),
  success: boolean("success").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  action: text("action").notNull(),
  instanceId: text("instance_id"),
  detail: text("detail"),
});

export type Instance = typeof instances.$inferSelect;
export type Snapshot = typeof instanceSnapshots.$inferSelect;
export type IntakeRequest = typeof requests.$inferSelect;
