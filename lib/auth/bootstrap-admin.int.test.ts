import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { admitEmail, memberForNewSession } from "./admission";

// BOOTSTRAP_ADMIN_EMAIL on a group that already has an admin: the variable is
// ignored and the address is a stranger like any other. The first sign-in on
// an empty database is covered by test/int/fresh-install.int.test.ts.
describeDb("first admin from BOOTSTRAP_ADMIN_EMAIL, once the group has an admin", () => {
  const scope = makeScope("boot");
  const address = `${scope.prefix}.first@example.invalid`;
  const saved = process.env.BOOTSTRAP_ADMIN_EMAIL;

  beforeAll(async () => {
    const admin = await scope.createExtraMember("admin");
    await scope.sql`UPDATE members SET role = 'admin' WHERE member_id = ${admin}`;
    process.env.BOOTSTRAP_ADMIN_EMAIL = address.toUpperCase();
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    else process.env.BOOTSTRAP_ADMIN_EMAIL = saved;
    await scope.sql`DELETE FROM members WHERE lower(email) = ${address}`;
    await scope.cleanup();
  });

  it("refuses the address and creates no member", async () => {
    expect(await admitEmail(address, { emailVerified: true })).toEqual({ kind: "deny", error: "NotMember" });
    expect(await memberForNewSession(address, null)).toBeNull();
    expect(await scope.sql`SELECT 1 FROM members WHERE lower(email) = ${address}`).toHaveLength(0);
  });
});
