import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "./client";
import {
  auditLog,
  instances,
  instanceSnapshots,
  loginAttempts,
  provisioningSteps,
  requests,
  type Instance,
  type Snapshot,
} from "./schema";
import type { StepId, StepStatus } from "@/lib/provisioning/steps";

// Registry reads and the small writes shared by several actions.

export interface InstanceRow {
  instance: Instance;
  latest: Snapshot | null;
}

export async function listInstancesWithLatest(includeArchived = false): Promise<InstanceRow[]> {
  const db = getDb();
  const list = await db
    .select()
    .from(instances)
    .where(includeArchived ? undefined : sql`${instances.status} <> 'archived'`)
    .orderBy(asc(instances.rolloutOrder), asc(instances.name));
  if (!list.length) return [];
  const latest = await db
    .selectDistinctOn([instanceSnapshots.instanceId])
    .from(instanceSnapshots)
    .where(inArray(instanceSnapshots.instanceId, list.map((i) => i.id)))
    .orderBy(instanceSnapshots.instanceId, desc(instanceSnapshots.takenAt));
  const byId = new Map(latest.map((s) => [s.instanceId, s]));
  return list.map((instance) => ({ instance, latest: byId.get(instance.id) ?? null }));
}

export async function getInstance(id: string): Promise<Instance | null> {
  const [row] = await getDb().select().from(instances).where(eq(instances.id, id)).limit(1);
  return row ?? null;
}

export async function getInstanceBySlug(slug: string): Promise<Instance | null> {
  const [row] = await getDb().select().from(instances).where(eq(instances.slug, slug)).limit(1);
  return row ?? null;
}

export async function listSnapshots(instanceId: string, limit = 60): Promise<Snapshot[]> {
  return getDb()
    .select()
    .from(instanceSnapshots)
    .where(eq(instanceSnapshots.instanceId, instanceId))
    .orderBy(desc(instanceSnapshots.takenAt))
    .limit(limit);
}

export async function listSteps(instanceId: string) {
  return getDb().select().from(provisioningSteps).where(eq(provisioningSteps.instanceId, instanceId));
}

export async function setStep(instanceId: string, step: StepId, status: StepStatus, detail: string | null = null) {
  await getDb()
    .insert(provisioningSteps)
    .values({ instanceId, step, status, detail, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [provisioningSteps.instanceId, provisioningSteps.step],
      set: { status, detail, updatedAt: new Date() },
    });
}

/** Records a write action. `detail` must never contain a secret value. */
export async function audit(action: string, instanceId: string | null, detail: string | null = null) {
  await getDb()
    .insert(auditLog)
    .values({ action, instanceId, detail: detail?.slice(0, 500) ?? null });
}

export async function listAudit(instanceId: string | null, limit = 50) {
  return getDb()
    .select()
    .from(auditLog)
    .where(instanceId ? eq(auditLog.instanceId, instanceId) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(limit);
}

export async function listRequests() {
  return getDb().select().from(requests).orderBy(desc(requests.createdAt)).limit(200);
}

export async function getRequest(id: string) {
  const [row] = await getDb().select().from(requests).where(eq(requests.id, id)).limit(1);
  return row ?? null;
}

export async function countRecentRequests(ipHash: string, since: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(requests)
    .where(and(eq(requests.ipHash, ipHash), gte(requests.createdAt, since)));
  return row?.n ?? 0;
}

export async function countRecentLoginFailures(ipHash: string, since: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ipHash, ipHash), eq(loginAttempts.success, false), gte(loginAttempts.attemptedAt, since)));
  return row?.n ?? 0;
}

export async function recordLoginAttempt(ipHash: string, success: boolean) {
  const db = getDb();
  await db.insert(loginAttempts).values({ ipHash, success });
  // Keep the table small: attempts older than a day are no use to the limit.
  await db.delete(loginAttempts).where(sql`${loginAttempts.attemptedAt} < now() - interval '1 day'`);
}

export async function insertSnapshot(values: typeof instanceSnapshots.$inferInsert) {
  await getDb().insert(instanceSnapshots).values(values);
}
