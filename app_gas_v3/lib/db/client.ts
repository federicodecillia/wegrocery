import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!dbInstance) {
    const sql = neon(databaseUrl);
    dbInstance = drizzle({ client: sql });
  }

  return dbInstance;
}
