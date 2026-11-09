import { expect, it } from "vitest";
import { INVARIANT_CHECKS } from "../lib/invariants";
import { buildRecoveryValidationSql, compareRecoveryReports } from "./recovery-validation";

it("wraps every unchanged money check in a count-only read transaction", () => {
  const sql = buildRecoveryValidationSql();
  expect(sql).toContain("BEGIN READ ONLY;");
  expect(sql.match(/'kind','invariant'/g)).toHaveLength(INVARIANT_CHECKS.length);
  for (const check of INVARIANT_CHECKS) expect(sql).toContain(`'name','${check.name}'`);
  expect(sql).not.toMatch(/SELECT\s+\*/i);
  expect(sql).toContain("'triggers'");
  expect(sql).toContain("'sequence_definitions'");
  expect(sql).toContain("'is_called'");
});

const baseline = () => [
  {kind:"identity",database:"neondb",role:"neondb_owner",major:18},
  {kind:"catalog",sha256:"synthetic"},
  {kind:"table",name:"_migrations",count:55,sha256:"synthetic"},
  ...INVARIANT_CHECKS.map((check) => ({kind:"invariant",name:check.name,violations:0})),
];
it("requires matching schema/data digests and all zero-violation checks", () => {
  expect(() => compareRecoveryReports(baseline(),baseline().reverse())).not.toThrow();
  const changed=baseline(); changed[1]={kind:"catalog",sha256:"different"};
  expect(() => compareRecoveryReports(baseline(),changed)).toThrow();
  expect(() => compareRecoveryReports(baseline(),[])).toThrow();
  const broken=baseline(); broken.push({kind:"invariant",name:"unexpected",violations:1});
  expect(() => compareRecoveryReports(baseline(),broken)).toThrow();
});
