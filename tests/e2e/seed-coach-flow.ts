/**
 * Seed the throwaway coach-flow database. Idempotent: a previous fixture game
 * and coach are removed first. No media file is written.
 */
import postgres from "postgres";

import { hashPassword } from "../../src/lib/auth/password";

import {
  assertDisposableDatabase,
  E2E_COACH,
  E2E_GAME,
} from "./coach-flow-fixture";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  assertDisposableDatabase(databaseUrl);

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const passwordHash = await hashPassword(E2E_COACH.password);
    await sql.begin(async (tx) => {
      await tx`delete from games where title = ${E2E_GAME.title}`;
      await tx`delete from coaches where email = ${E2E_COACH.email}`;
      const [coach] = await tx<{ id: string }[]>`
        insert into coaches (email, name, password_hash)
        values (${E2E_COACH.email}, ${E2E_COACH.name}, ${passwordHash})
        returning id
      `;
      const [game] = await tx<{ id: string }[]>`
        insert into games (title, opponent, played_on, created_by, media_home)
        values (
          ${E2E_GAME.title},
          ${E2E_GAME.opponent},
          ${E2E_GAME.playedOn},
          ${coach.id},
          'drive'
        )
        returning id
      `;
      await tx`
        insert into game_sources (game_id, order_index, file_path, duration_s)
        values (
          ${game.id},
          0,
          ${E2E_GAME.filePath},
          ${E2E_GAME.durationS}
        )
      `;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((cause: unknown) => {
  console.error("e2e seed failed");
  console.error(cause instanceof Error ? cause.message : "unknown error");
  process.exit(1);
});
