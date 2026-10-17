import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getUsageTotals, recordUsage } from "@/lib/usage/events";
import { describeDb, runSql, testSql as sql } from "./fixtures";

// drizzle/0037_usage_events.sql and the counters on a real database: the
// table has no column that could name a person, a count adds up, the demo
// records nothing, and the rollback file drops the table.
describeDb("usage events", () => {
  const saved = process.env.DEMO_MODE;
  const count = async (name: string) => {
    const rows = await sql`SELECT coalesce(sum(count), 0)::int AS n FROM usage_events WHERE name = ${name}`;
    return rows[0].n as number;
  };

  beforeAll(async () => {
    delete process.env.DEMO_MODE;
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = saved;
  });

  it("applies again without errors, with only day, name and count", async () => {
    const statement = readFileSync("drizzle/0037_usage_events.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .trim()
      .replace(/;$/, "");
    await runSql(statement);
    const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_events' ORDER BY column_name`;
    expect(columns.map((c) => c.column_name)).toEqual(["count", "day", "name"]);
  });

  it("adds one per event and keeps names apart", async () => {
    const before = { saved: await count("order_saved"), cancelled: await count("order_cancelled") };
    await recordUsage("order_saved");
    await recordUsage("order_saved");
    await recordUsage("order_cancelled");
    expect(await count("order_saved")).toBe(before.saved + 2);
    expect(await count("order_cancelled")).toBe(before.cancelled + 1);
  });

  it("totals the last days and ignores names it does not know", async () => {
    await sql`INSERT INTO usage_events (day, name, count) VALUES (current_date - 5, 'mystery_event', 9) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO usage_events (day, name, count) VALUES (current_date - 40, 'cycle_closed', 7) ON CONFLICT DO NOTHING`;
    const totals = await getUsageTotals(30);
    expect(totals.find((t) => t.name === "order_saved")?.total).toBeGreaterThanOrEqual(2);
    expect(totals.map((t) => t.name)).not.toContain("mystery_event");
    // 40 days ago is outside the window: only today's closes count.
    const closed = totals.find((t) => t.name === "cycle_closed")?.total ?? 0;
    expect(closed).toBe(await count("cycle_closed").then((all) => all - 7));
    await sql`DELETE FROM usage_events WHERE name = 'mystery_event' OR (name = 'cycle_closed' AND day = current_date - 40)`;
  });

  it("records nothing in the demo", async () => {
    process.env.DEMO_MODE = "true";
    const before = await count("login");
    await recordUsage("login");
    expect(await count("login")).toBe(before);
    delete process.env.DEMO_MODE;
  });

  it("has a rollback that drops the table, and the table can come back", async () => {
    const down = readFileSync("drizzle/0037_usage_events_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .trim()
      .replace(/;$/, "");
    await runSql(down);
    await expect(sql`SELECT 1 FROM usage_events`).rejects.toThrow();
    // A missing table never breaks the caller.
    await expect(recordUsage("login")).resolves.toBeUndefined();
    await expect(getUsageTotals(30)).resolves.toEqual([]);
    await runSql(
      readFileSync("drizzle/0037_usage_events.sql", "utf8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("--"))
        .join("\n")
        .trim()
        .replace(/;$/, ""),
    );
  });
});
