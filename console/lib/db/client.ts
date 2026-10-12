import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { randomBytes } from "node:crypto";

// The registry database (the console's own Neon project). Created lazily so
// `next build` needs no DATABASE_URL.

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!dbInstance) dbInstance = drizzle({ client: neon(databaseUrl) });
  return dbInstance;
}

export function newId(prefix: "ins" | "req"): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}
