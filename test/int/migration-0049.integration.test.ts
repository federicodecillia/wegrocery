import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { getMyOpenAlerts } from "@/lib/db/calendar";
import { sendOpenAlerts } from "@/lib/notifications/open-alerts";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0049_cycle_open_alerts.sql on a real database: the requests are
// stored once per person and cycle, go with their cycle, are consumed when
// the cycle opens (no email for those who get the cycle_opened email anyway),
// and the rollback file undoes it. The test setup drops RESEND_API_KEY, so no
// email leaves.
describeDb("migration 0049 (cycle open alerts)", () => {
  const scope = makeScope("m0049");
  const { sql } = scope;
  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  const table = () => sql`SELECT to_regclass('public.cycle_open_alerts') AS t`;
  const otherId = scope.id("other");

  beforeAll(async () => {
    await scope.createMember();
    await sql`INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
      VALUES (${otherId}, ${`${scope.memberName} other`}, ${`${scope.prefix}_other@example.invalid`}, 'utenti', true, now(), now())`;
  });

  afterAll(async () => {
    await sql`DELETE FROM notification_preferences WHERE member_id = ${otherId}`;
    await sql`DELETE FROM members WHERE member_id = ${otherId}`;
    await scope.cleanup();
  });

  it("applies again without errors", async () => {
    for (const statement of statements("drizzle/0049_cycle_open_alerts.sql")) await runSql(statement);
    expect((await table())[0].t).toBe("cycle_open_alerts");
  });

  it("keeps one request per person and cycle, and drops them with the cycle", async () => {
    const { cycleId } = await scope.createCycle("dropped");
    await sql`INSERT INTO cycle_open_alerts (cycle_id, member_id) VALUES (${cycleId}, ${scope.memberId})`;
    await expect(sql`INSERT INTO cycle_open_alerts (cycle_id, member_id) VALUES (${cycleId}, ${scope.memberId})`).rejects.toThrow();
    expect(await getMyOpenAlerts(scope.memberId)).toContain(cycleId);
    await sql`DELETE FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(await getMyOpenAlerts(scope.memberId)).not.toContain(cycleId);
  });

  it("emails only those not emailed already, and forgets the requests", async () => {
    const { cycleId } = await scope.createCycle("opened");
    await sql`INSERT INTO cycle_open_alerts (cycle_id, member_id) VALUES (${cycleId}, ${scope.memberId}), (${cycleId}, ${otherId})`;
    // The other person already gets the cycle_opened email.
    await sql`INSERT INTO notification_preferences (member_id, category, app_enabled, email_enabled, updated_at)
      VALUES (${otherId}, 'cycle_opened', true, true, now())`;
    const sent = await sendOpenAlerts(getDb(), { cycleId, title: "Formaggi", orderCloseAt: new Date() });
    expect(sent).toBe(1);
    const [left] = await sql`SELECT count(*)::int AS n FROM cycle_open_alerts WHERE cycle_id = ${cycleId}`;
    expect(left.n).toBe(0);
  });

  it("has a rollback that drops the table", async () => {
    for (const statement of statements("drizzle/0049_cycle_open_alerts_down.sql")) await runSql(statement);
    expect((await table())[0].t).toBeNull();
    for (const statement of statements("drizzle/0049_cycle_open_alerts.sql")) await runSql(statement);
    expect((await table())[0].t).toBe("cycle_open_alerts");
  });
});
