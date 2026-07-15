/**
 * The database client. Server-only: importing this from a client component
 * throws at build time, so the connection string never reaches the browser.
 *
 * The client is created lazily on first query rather than at module import. This
 * keeps `next build` working without a database: build-time page-data collection
 * imports server modules (pages, route handlers) that transitively reach this
 * one, and an eager connect - or an eager throw on a missing DATABASE_URL - would
 * fail that collection. Deferring to first use moves the check to request time,
 * where a missing connection string is a genuine misconfiguration.
 */
import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

// Reuse a single postgres client across hot reloads in development, otherwise
// each reload opens a new pool and exhausts the database's connections.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

let instance: Database | undefined;

function getDb(): Database {
  if (instance) return instance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set - the app cannot reach the database.",
    );
  }

  const client = globalForDb.pgClient ?? postgres(connectionString);
  if (process.env.NODE_ENV !== "production") {
    globalForDb.pgClient = client;
  }

  instance = drizzle(client, { schema });
  return instance;
}

/**
 * The drizzle client, resolved on first property access. Callers use it exactly
 * like a drizzle instance (`db.select(...)`, `db.query.*`); the underlying
 * connection is only established when the first query runs.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
