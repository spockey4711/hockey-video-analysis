/**
 * The database client. Server-only: importing this from a client component
 * throws at build time, so the connection string never reaches the browser.
 */
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set - the app cannot reach the database.",
  );
}

// Reuse a single postgres client across hot reloads in development, otherwise
// each reload opens a new pool and exhausts the database's connections.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client = globalForDb.pgClient ?? postgres(connectionString);
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });

export { schema };
