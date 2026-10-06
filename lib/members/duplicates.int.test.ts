import { afterAll, beforeAll, expect, it } from "vitest";
import { getDismissedDuplicatePairs } from "@/lib/db/queries";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { pairKey } from "./duplicates";

// Dismissed duplicate pairs on a real database: read back by the query, kept
// in order by the CHECK, gone with a deleted member.
describeDb("member duplicate dismissals", () => {
  const scope = makeScope("dups");
  const { sql } = scope;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("reads a dismissed pair and drops it with a deleted member", async () => {
    const x = await scope.createExtraMember("x");
    const y = await scope.createExtraMember("y");
    const [a, b] = pairKey(x, y);
    await sql`INSERT INTO member_duplicate_dismissals (member_a, member_b, dismissed_by) VALUES (${a}, ${b}, 'int-test')`;
    expect((await getDismissedDuplicatePairs()).has(`${a}:${b}`)).toBe(true);

    await expect(
      sql`INSERT INTO member_duplicate_dismissals (member_a, member_b, dismissed_by) VALUES (${b}, ${a}, 'int-test')`,
    ).rejects.toThrow();

    await sql`DELETE FROM members WHERE member_id = ${b}`;
    expect((await getDismissedDuplicatePairs()).has(`${a}:${b}`)).toBe(false);
  });
});
