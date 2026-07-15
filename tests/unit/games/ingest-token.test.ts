import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getIngestToken,
  readBearerToken,
  verifyIngestToken,
} from "@/features/games/ingest-token";

const SECRET = "ingest-secret-abcdef123456";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getIngestToken", () => {
  it("returns the configured token, trimmed", () => {
    vi.stubEnv("INGEST_TOKEN", `  ${SECRET}  `);
    expect(getIngestToken()).toBe(SECRET);
  });

  it("treats unset or whitespace-only as disabled", () => {
    vi.stubEnv("INGEST_TOKEN", "");
    expect(getIngestToken()).toBeUndefined();
    vi.stubEnv("INGEST_TOKEN", "   ");
    expect(getIngestToken()).toBeUndefined();
  });
});

describe("readBearerToken", () => {
  it("extracts the credential from a Bearer header", () => {
    expect(readBearerToken(`Bearer ${SECRET}`)).toBe(SECRET);
    expect(readBearerToken(`  Bearer ${SECRET}  `)).toBe(SECRET);
  });

  it("returns null for a missing, malformed, or non-bearer header", () => {
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken("")).toBeNull();
    expect(readBearerToken(SECRET)).toBeNull();
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken("Bearer")).toBeNull();
  });
});

describe("verifyIngestToken", () => {
  it("accepts the exact token", () => {
    vi.stubEnv("INGEST_TOKEN", SECRET);
    expect(verifyIngestToken(SECRET)).toBe(true);
  });

  it("rejects a wrong token", () => {
    vi.stubEnv("INGEST_TOKEN", SECRET);
    expect(verifyIngestToken("wrong")).toBe(false);
    expect(verifyIngestToken(`${SECRET}x`)).toBe(false);
  });

  it("rejects every candidate when ingest is disabled", () => {
    vi.stubEnv("INGEST_TOKEN", "");
    expect(verifyIngestToken(SECRET)).toBe(false);
  });

  it("rejects non-string and empty candidates", () => {
    vi.stubEnv("INGEST_TOKEN", SECRET);
    expect(verifyIngestToken("")).toBe(false);
    expect(verifyIngestToken(undefined)).toBe(false);
    expect(verifyIngestToken(null)).toBe(false);
    expect(verifyIngestToken(123)).toBe(false);
  });
});
