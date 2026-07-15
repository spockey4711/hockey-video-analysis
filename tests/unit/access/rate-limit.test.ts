import { beforeEach, describe, expect, it } from "vitest";

import {
  _resetAll,
  checkRateLimit,
  recordFailure,
  reset,
} from "@/features/access/rate-limit";

beforeEach(() => {
  _resetAll();
});

describe("login rate limiting", () => {
  it("allows attempts below the threshold", () => {
    for (let i = 0; i < 4; i++) recordFailure("k");
    expect(checkRateLimit("k").limited).toBe(false);
  });

  it("blocks once the threshold of failures is reached", () => {
    for (let i = 0; i < 5; i++) recordFailure("k");
    const result = checkRateLimit("k");
    expect(result.limited).toBe(true);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("clears the counter on a successful login", () => {
    for (let i = 0; i < 5; i++) recordFailure("k");
    reset("k");
    expect(checkRateLimit("k").limited).toBe(false);
  });

  it("opens a fresh window after the previous one expires", () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i++) recordFailure("k", start);
    expect(checkRateLimit("k", start).limited).toBe(true);
    // Far past the 15-minute window.
    const later = start + 16 * 60 * 1000;
    expect(checkRateLimit("k", later).limited).toBe(false);
  });

  it("keeps separate counters per key", () => {
    for (let i = 0; i < 5; i++) recordFailure("a");
    expect(checkRateLimit("a").limited).toBe(true);
    expect(checkRateLimit("b").limited).toBe(false);
  });
});
