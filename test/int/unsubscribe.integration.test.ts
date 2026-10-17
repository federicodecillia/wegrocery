import { afterAll, beforeAll, expect, it } from "vitest";
import { GET, POST } from "@/app/api/unsubscribe/route";
import { signUnsubscribeToken } from "@/lib/email/unsubscribe";
import { describeDb, makeScope } from "./fixtures";

// The one-click unsubscribe endpoint: public, acts only on a signed token, and
// a GET never changes anything.
describeDb("one-click unsubscribe", () => {
  const scope = makeScope("unsub");
  const { sql } = scope;
  const secret = "u".repeat(40);
  const saved = process.env.AUTH_SECRET;
  const url = (token: string) => `https://app.example/api/unsubscribe?t=${encodeURIComponent(token)}`;
  const emailEnabled = async () =>
    (await sql`SELECT app_enabled, email_enabled FROM notification_preferences WHERE member_id = ${scope.memberId} AND category = 'order_charge'`) as {
      app_enabled: boolean;
      email_enabled: boolean;
    }[];

  beforeAll(async () => {
    process.env.AUTH_SECRET = secret;
    await scope.createMember();
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved;
    await sql`DELETE FROM notification_preferences WHERE member_id = ${scope.memberId}`;
    await scope.cleanup();
  });

  it("changes nothing on a GET, even with a valid token, and shows a button", async () => {
    const token = signUnsubscribeToken(scope.memberId, "order_charge", secret);
    const res = await GET(new Request(url(token)));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<form");
    expect(await emailEnabled()).toEqual([]);
  });

  it("turns the email channel off on a POST and keeps the app channel", async () => {
    await sql`INSERT INTO notification_preferences (member_id, category, app_enabled, email_enabled, updated_at)
      VALUES (${scope.memberId}, 'order_charge', false, true, now())`;
    const token = signUnsubscribeToken(scope.memberId, "order_charge", secret);
    const res = await POST(new Request(url(token), { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } }));
    expect(res.status).toBe(200);
    expect(await emailEnabled()).toEqual([{ app_enabled: false, email_enabled: false }]);
    // Again: still fine.
    expect((await POST(new Request(url(token), { method: "POST" }))).status).toBe(200);
  });

  it("answers 400 and writes nothing for a forged token", async () => {
    await sql`DELETE FROM notification_preferences WHERE member_id = ${scope.memberId}`;
    const forged = signUnsubscribeToken(scope.memberId, "order_charge", "z".repeat(40));
    expect((await POST(new Request(url(forged), { method: "POST" }))).status).toBe(400);
    expect((await GET(new Request(url("garbage")))).status).toBe(400);
    expect(await emailEnabled()).toEqual([]);
  });

  it("creates the row with the category's default app channel when none was saved", async () => {
    const token = signUnsubscribeToken(scope.memberId, "order_charge", secret);
    await POST(new Request(url(token), { method: "POST" }));
    expect(await emailEnabled()).toEqual([{ app_enabled: true, email_enabled: false }]);
  });
});
