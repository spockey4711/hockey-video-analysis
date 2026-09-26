import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains session.ts uses, recording each call so the
// tests pin what is read, written and deleted without a database.
const db = vi.hoisted(() => {
  const selectRows = { value: [] as unknown[] };
  const limit = vi.fn(async () => selectRows.value);
  const selectWhere = vi.fn(() => ({ limit }));
  const innerJoin = vi.fn(() => ({ where: selectWhere }));
  const from = vi.fn(() => ({ innerJoin }));

  const deleteReturning = vi.fn(async () => [] as unknown[]);
  const deleteWhere = vi.fn<
    (where: unknown) => Promise<void> & { returning: typeof deleteReturning }
  >(() => Object.assign(Promise.resolve(), { returning: deleteReturning }));

  const updateWhere = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where: updateWhere }));

  const values = vi.fn(async () => undefined);

  return {
    selectRows,
    limit,
    deleteWhere,
    deleteReturning,
    set,
    updateWhere,
    values,
    client: {
      select: vi.fn(() => ({ from })),
      delete: vi.fn(() => ({ where: deleteWhere })),
      update: vi.fn(() => ({ set })),
      insert: vi.fn(() => ({ values })),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import {
  DEVICE_SESSION_IDLE_MS,
  LAST_SEEN_INTERVAL_MS,
  SESSION_DURATION_MS,
} from "@/lib/auth/config";
import {
  createSession,
  revokeOtherSessions,
  revokeSession,
  sessionExpiresAt,
  shouldRecordUse,
  validateSessionToken,
} from "@/lib/auth/session";
import { hashSessionToken } from "@/lib/auth/tokens";

const dialect = new PgDialect();
function render(where: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(where as SQL);
}

const NOW = new Date("2026-09-26T12:00:00Z");
const TOKEN = "a".repeat(64);
const PUBLIC_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function row(overrides: Record<string, unknown> = {}) {
  return {
    publicId: PUBLIC_ID,
    kind: "web",
    lastSeenAt: new Date(NOW.getTime() - 5 * 60 * 1000),
    expiresAt: new Date(NOW.getTime() + SESSION_DURATION_MS),
    coachId: "coach-1",
    email: "coach@example.test",
    name: "Coach",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.selectRows.value = [];
});

describe("session lifetimes", () => {
  it("gives a web session a fixed 30 days and a device session 180 idle days", () => {
    expect(sessionExpiresAt("web", NOW).getTime()).toBe(
      NOW.getTime() + SESSION_DURATION_MS,
    );
    expect(sessionExpiresAt("device", NOW).getTime()).toBe(
      NOW.getTime() + DEVICE_SESSION_IDLE_MS,
    );
    expect(DEVICE_SESSION_IDLE_MS).toBe(180 * 24 * 60 * 60 * 1000);
  });

  it("records a use at most once an hour", () => {
    const justUnder = new Date(NOW.getTime() - LAST_SEEN_INTERVAL_MS + 1);
    const exactly = new Date(NOW.getTime() - LAST_SEEN_INTERVAL_MS);
    expect(shouldRecordUse(justUnder, NOW)).toBe(false);
    expect(shouldRecordUse(exactly, NOW)).toBe(true);
    expect(LAST_SEEN_INTERVAL_MS).toBe(60 * 60 * 1000);
  });
});

describe("createSession", () => {
  it("stores the hash, kind and device name, never the raw token", async () => {
    const { token, expiresAt } = await createSession(
      "coach-1",
      { kind: "device", deviceName: "MacBook Trainer" },
      NOW,
    );

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(db.values).toHaveBeenCalledWith({
      id: hashSessionToken(token),
      coachId: "coach-1",
      kind: "device",
      deviceName: "MacBook Trainer",
      lastSeenAt: NOW,
      expiresAt,
    });
    expect(JSON.stringify(db.values.mock.calls)).not.toContain(token);
  });
});

describe("validateSessionToken", () => {
  it("answers the session without a write when it was used within the hour", async () => {
    db.selectRows.value = [row()];

    const session = await validateSessionToken(TOKEN, "web", NOW);

    expect(session).toEqual({
      publicId: PUBLIC_ID,
      kind: "web",
      expiresAt: row().expiresAt,
      coach: { id: "coach-1", email: "coach@example.test", name: "Coach" },
    });
    expect(session).not.toHaveProperty("token");
    expect(db.client.update).not.toHaveBeenCalled();
    expect(db.client.delete).not.toHaveBeenCalled();
  });

  it("refuses a device token presented as a cookie, and leaves it valid", async () => {
    db.selectRows.value = [row({ kind: "device" })];

    await expect(validateSessionToken(TOKEN, "web", NOW)).resolves.toBeNull();
    expect(db.client.delete).not.toHaveBeenCalled();
  });

  it("refuses a web cookie presented as a bearer token", async () => {
    db.selectRows.value = [row({ kind: "web" })];

    await expect(
      validateSessionToken(TOKEN, "device", NOW),
    ).resolves.toBeNull();
  });

  it("refuses an unknown token", async () => {
    await expect(validateSessionToken(TOKEN, "web", NOW)).resolves.toBeNull();
  });

  it("deletes and refuses an expired session", async () => {
    db.selectRows.value = [row({ expiresAt: NOW })];

    await expect(validateSessionToken(TOKEN, "web", NOW)).resolves.toBeNull();
    expect(db.client.delete).toHaveBeenCalledTimes(1);
  });

  it("writes last use once the hour is up, keeping a web session's fixed expiry", async () => {
    const stale = row({
      lastSeenAt: new Date(NOW.getTime() - 2 * LAST_SEEN_INTERVAL_MS),
    });
    db.selectRows.value = [stale];

    const session = await validateSessionToken(TOKEN, "web", NOW);

    expect(db.set).toHaveBeenCalledWith({
      lastSeenAt: NOW,
      expiresAt: stale.expiresAt,
    });
    expect(session?.expiresAt).toBe(stale.expiresAt);
  });

  it("renews a device session's idle expiry when it records a use", async () => {
    db.selectRows.value = [
      row({
        kind: "device",
        lastSeenAt: new Date(NOW.getTime() - 3 * 24 * LAST_SEEN_INTERVAL_MS),
        expiresAt: new Date(NOW.getTime() + 10 * LAST_SEEN_INTERVAL_MS),
      }),
    ];

    const session = await validateSessionToken(TOKEN, "device", NOW);

    const renewed = new Date(NOW.getTime() + DEVICE_SESSION_IDLE_MS);
    expect(db.set).toHaveBeenCalledWith({
      lastSeenAt: NOW,
      expiresAt: renewed,
    });
    expect(session?.expiresAt).toEqual(renewed);
  });
});

describe("revoking sessions", () => {
  it("signs one session out only within the coach's own sessions", async () => {
    db.deleteReturning.mockResolvedValue([{ publicId: PUBLIC_ID }]);

    await expect(revokeSession("coach-1", PUBLIC_ID)).resolves.toBe(true);

    const query = render(db.deleteWhere.mock.calls[0]?.[0]);
    expect(query.sql).toBe(
      '("sessions"."coach_id" = $1 and "sessions"."public_id" = $2)',
    );
    expect(query.params).toEqual(["coach-1", PUBLIC_ID]);
  });

  it("reports a session that was already gone", async () => {
    db.deleteReturning.mockResolvedValue([]);

    await expect(revokeSession("coach-1", PUBLIC_ID)).resolves.toBe(false);
  });

  it("signs out every other session of the coach, of both kinds", async () => {
    db.deleteReturning.mockResolvedValue([
      { publicId: "x" },
      { publicId: "y" },
    ]);

    await expect(revokeOtherSessions("coach-1", PUBLIC_ID)).resolves.toBe(2);

    const query = render(db.deleteWhere.mock.calls[0]?.[0]);
    // No filter on `kind`: the Mac is signed out with the other browsers.
    expect(query.sql).toBe(
      '("sessions"."coach_id" = $1 and "sessions"."public_id" <> $2)',
    );
    expect(query.params).toEqual(["coach-1", PUBLIC_ID]);
  });
});
