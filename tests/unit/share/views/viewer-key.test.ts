import { describe, expect, it } from "vitest";

import {
  clientIp,
  createDailySaltStore,
  utcDay,
  viewerKey,
} from "@/features/share/views/viewer-key";

const fingerprint = {
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0 (Test)",
  collectionId: "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f",
};

function counterSalts() {
  let next = 0;
  return () => Buffer.from([++next]);
}

describe("utcDay", () => {
  it("buckets by the UTC calendar day", () => {
    expect(utcDay(new Date("2026-09-25T23:59:59.999Z"))).toBe("2026-09-25");
    expect(utcDay(new Date("2026-09-26T00:00:00.000Z"))).toBe("2026-09-26");
  });
});

describe("createDailySaltStore", () => {
  it("hands out the same salt all day", () => {
    const store = createDailySaltStore(counterSalts());
    expect(store.saltFor("2026-09-25")).toEqual(store.saltFor("2026-09-25"));
  });

  it("rotates the salt when the day changes", () => {
    const store = createDailySaltStore(counterSalts());
    const monday = store.saltFor("2026-09-21");
    expect(store.saltFor("2026-09-22")).not.toEqual(monday);
  });

  it("forgets a day's salt once the next day starts", () => {
    const store = createDailySaltStore(counterSalts());
    const monday = store.saltFor("2026-09-21");
    store.saltFor("2026-09-22");
    // Asking for the old day again mints a new salt: the old one is gone.
    expect(store.saltFor("2026-09-21")).not.toEqual(monday);
  });

  it("makes random 32-byte salts by default", () => {
    const store = createDailySaltStore();
    const salt = store.saltFor("2026-09-25");
    expect(salt).toHaveLength(32);
    expect(createDailySaltStore().saltFor("2026-09-25")).not.toEqual(salt);
  });
});

describe("viewerKey", () => {
  const salt = Buffer.from("salt-of-the-day");

  it("is a stable 256-bit hex digest for the same viewer on the same day", () => {
    const key = viewerKey(salt, fingerprint);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(viewerKey(salt, { ...fingerprint })).toBe(key);
  });

  it("contains none of the raw values it was derived from", () => {
    const key = viewerKey(salt, fingerprint);
    expect(key).not.toContain(fingerprint.ip);
    expect(key).not.toContain("203");
    expect(key).not.toContain(fingerprint.userAgent);
    expect(key).not.toContain(fingerprint.collectionId);
  });

  it("changes with the salt, so a key cannot be matched across days", () => {
    expect(viewerKey(Buffer.from("tomorrow"), fingerprint)).not.toBe(
      viewerKey(salt, fingerprint),
    );
  });

  it("differs per IP, user agent and collection", () => {
    const key = viewerKey(salt, fingerprint);
    expect(viewerKey(salt, { ...fingerprint, ip: "203.0.113.8" })).not.toBe(
      key,
    );
    expect(viewerKey(salt, { ...fingerprint, userAgent: "Other" })).not.toBe(
      key,
    );
    expect(
      viewerKey(salt, {
        ...fingerprint,
        collectionId: "00000000-0000-4000-8000-000000000000",
      }),
    ).not.toBe(key);
  });

  it("does not let fields run into each other", () => {
    expect(
      viewerKey(salt, { ip: "1.2.3.4", userAgent: "5x", collectionId: "c" }),
    ).not.toBe(
      viewerKey(salt, { ip: "1.2.3.45", userAgent: "x", collectionId: "c" }),
    );
  });
});

describe("clientIp", () => {
  it("prefers the proxy's X-Real-IP", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1, 203.0.113.7",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to the first X-Forwarded-For entry", () => {
    const headers = new Headers({
      "x-forwarded-for": " 198.51.100.1 , 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("198.51.100.1");
  });

  it("is empty when no proxy header is present", () => {
    expect(clientIp(new Headers())).toBe("");
  });
});
