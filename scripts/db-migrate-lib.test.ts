import { describe, expect, it } from "vitest";
import { isMigrationFile, refusesProduction, splitStatements } from "./db-migrate-lib.mjs";

describe("isMigrationFile", () => {
  it("applies numbered SQL and never a rollback file", () => {
    expect(isMigrationFile("0036_thing.sql")).toBe(true);
    expect(isMigrationFile("0036_thing_down.sql")).toBe(false);
    expect(isMigrationFile("README.md")).toBe(false);
  });
});

describe("splitStatements", () => {
  it("splits on semicolons and drops comment lines, even with SQL in them", () => {
    const raw = "-- example: SELECT 1; SELECT 2;\nCREATE TABLE a (id int);\nCREATE INDEX i ON a (id);\n";
    expect(splitStatements(raw)).toEqual(["CREATE TABLE a (id int)", "CREATE INDEX i ON a (id)"]);
  });

  it("splits on drizzle's statement-breakpoint when present", () => {
    const raw = "CREATE TABLE a (x text DEFAULT ';');--> statement-breakpoint\nCREATE TABLE b (id int);";
    expect(splitStatements(raw)).toEqual(["CREATE TABLE a (x text DEFAULT ';')", "CREATE TABLE b (id int)"]);
  });

  it("drops a file's own BEGIN and COMMIT: the runner wraps the file in a transaction", () => {
    expect(splitStatements("BEGIN;\nALTER TABLE a ADD COLUMN b int;\nCOMMIT;")).toEqual(["ALTER TABLE a ADD COLUMN b int"]);
  });
});

describe("refusesProduction", () => {
  const prod = "postgres://u:p@ep-prod.eu-central-1.aws.neon.tech/db";
  const env = { PRODUCTION_DB_HOST: "ep-prod.eu-central-1.aws.neon.tech" };

  it("refuses the production host without --allow-prod", () => {
    expect(refusesProduction(prod, env, [])).toBe(true);
    expect(refusesProduction(prod, env, ["--status"])).toBe(true);
  });

  it("lets --allow-prod through", () => {
    expect(refusesProduction(prod, env, ["--allow-prod"])).toBe(false);
  });

  it("leaves other hosts alone", () => {
    expect(refusesProduction("postgres://u:p@ep-dev.neon.tech/db", env, [])).toBe(false);
  });

  it("knows nothing about production without PRODUCTION_DB_HOST", () => {
    expect(refusesProduction(prod, {}, [])).toBe(false);
  });
});
