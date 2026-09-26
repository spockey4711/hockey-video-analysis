import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the one `team_settings` row: the select reads its token, and
// the insert's upsert writes it the way Postgres would - a plain `set` value
// overwrites, the seed's `coalesce(...)` only fills an empty token. So the
// tests pin what the module does with the row without a database.
const table = vi.hoisted(() => {
  const state: { row: { token: string | null } | null } = {
    row: { token: null },
  };
  const isSql = (value: unknown) =>
    typeof value === "object" && value !== null && "queryChunks" in value;

  const select = vi.fn(() => {
    const step = {
      from: () => step,
      where: () => step,
      limit: () =>
        Promise.resolve(state.row ? [{ token: state.row.token }] : []),
    };
    return step;
  });
  const insert = vi.fn(() => ({
    values: (values: { teamShareToken: string }) => {
      const upsert = (set: { teamShareToken: unknown }) => {
        if (!state.row) state.row = { token: values.teamShareToken };
        else if (isSql(set.teamShareToken)) {
          state.row.token ??= values.teamShareToken;
        } else state.row.token = set.teamShareToken as string;
        const written = [{ token: state.row.token }];
        return Object.assign(Promise.resolve(written), {
          returning: () => Promise.resolve(written),
        });
      };
      return {
        onConflictDoUpdate: ({ set }: { set: { teamShareToken: unknown } }) =>
          upsert(set),
      };
    },
  }));
  return { state, client: { select, insert } };
});

vi.mock("@/lib/db", () => ({ db: table.client }));

import {
  getTeamShareToken,
  regenerateTeamShareToken,
  verifyTeamShareToken,
} from "@/features/share/team/token";

const SEED = "a".repeat(64);

beforeEach(() => {
  table.state.row = { token: null };
  table.client.insert.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getTeamShareToken", () => {
  it("returns the stored token and ignores the env once one is stored", async () => {
    table.state.row = { token: "stored" };
    vi.stubEnv("TEAM_SHARE_TOKEN", SEED);
    await expect(getTeamShareToken()).resolves.toBe("stored");
    expect(table.client.insert).not.toHaveBeenCalled();
  });

  it("seeds the first token from TEAM_SHARE_TOKEN into the row", async () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", `  ${SEED}  `);
    await expect(getTeamShareToken()).resolves.toBe(SEED);
    expect(table.state.row).toEqual({ token: SEED });

    // Seeded once: a later env change no longer moves the link.
    vi.stubEnv("TEAM_SHARE_TOKEN", "b".repeat(64));
    await expect(getTeamShareToken()).resolves.toBe(SEED);
    expect(table.client.insert).toHaveBeenCalledTimes(1);
  });

  it("creates the row when it is missing while seeding", async () => {
    table.state.row = null;
    vi.stubEnv("TEAM_SHARE_TOKEN", SEED);
    await expect(getTeamShareToken()).resolves.toBe(SEED);
    expect(table.state.row).toEqual({ token: SEED });
  });

  it("keeps the team view off with no stored token and no env seed", async () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", "");
    await expect(getTeamShareToken()).resolves.toBeUndefined();
    vi.stubEnv("TEAM_SHARE_TOKEN", "   ");
    await expect(getTeamShareToken()).resolves.toBeUndefined();
    expect(table.client.insert).not.toHaveBeenCalled();
    expect(table.state.row).toEqual({ token: null });
  });
});

describe("regenerateTeamShareToken", () => {
  it("turns the team view on with a fresh, unguessable token", async () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", "");
    const token = await regenerateTeamShareToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    await expect(getTeamShareToken()).resolves.toBe(token);
    await expect(verifyTeamShareToken(token)).resolves.toBe(true);
  });

  it("invalidates the old link at once, including a seeded one", async () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", SEED);
    await expect(verifyTeamShareToken(SEED)).resolves.toBe(true);

    const fresh = await regenerateTeamShareToken();

    expect(fresh).not.toBe(SEED);
    await expect(verifyTeamShareToken(SEED)).resolves.toBe(false);
    await expect(verifyTeamShareToken(fresh)).resolves.toBe(true);

    const next = await regenerateTeamShareToken();
    await expect(verifyTeamShareToken(fresh)).resolves.toBe(false);
    await expect(verifyTeamShareToken(next)).resolves.toBe(true);
  });
});

describe("verifyTeamShareToken", () => {
  beforeEach(() => {
    table.state.row = { token: SEED };
  });

  it("accepts the exact token", async () => {
    await expect(verifyTeamShareToken(SEED)).resolves.toBe(true);
  });

  it("rejects a wrong token", async () => {
    await expect(verifyTeamShareToken("wrong")).resolves.toBe(false);
    await expect(verifyTeamShareToken(`${SEED}x`)).resolves.toBe(false);
  });

  it("rejects every candidate while the view is off", async () => {
    table.state.row = { token: null };
    vi.stubEnv("TEAM_SHARE_TOKEN", "");
    await expect(verifyTeamShareToken(SEED)).resolves.toBe(false);
    await expect(verifyTeamShareToken("")).resolves.toBe(false);
  });

  it("rejects non-string and empty candidates", async () => {
    await expect(verifyTeamShareToken("")).resolves.toBe(false);
    await expect(verifyTeamShareToken(undefined)).resolves.toBe(false);
    await expect(verifyTeamShareToken(null)).resolves.toBe(false);
    await expect(verifyTeamShareToken(123)).resolves.toBe(false);
  });
});
