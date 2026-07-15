import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next, so it loads `.env` itself via dotenv above.
// `generate` needs no database; `migrate` reads DATABASE_URL from the environment.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
