import { describe, expect, it } from "vitest";

import {
  admitEvent,
  DAILY_EVENT_LIMIT,
  DEDUPE_WINDOW_MS,
  retentionCutoff,
} from "@/features/share/views/record";

const now = new Date("2026-09-25T12:00:00.000Z");

function ago(ms: number): Date {
  return new Date(now.getTime() - ms);
}

describe("admitEvent", () => {
  it("admits a viewer's first event of the day", () => {
    expect(admitEvent({ eventsToday: 0, lastIdenticalAt: null }, now)).toBe(
      "ok",
    );
  });

  it("drops an identical event sent within the dedupe window", () => {
    expect(admitEvent({ eventsToday: 1, lastIdenticalAt: ago(0) }, now)).toBe(
      "duplicate",
    );
    expect(
      admitEvent(
        { eventsToday: 1, lastIdenticalAt: ago(DEDUPE_WINDOW_MS - 1) },
        now,
      ),
    ).toBe("duplicate");
  });

  it("admits the same event again once the window has passed", () => {
    expect(
      admitEvent(
        { eventsToday: 1, lastIdenticalAt: ago(DEDUPE_WINDOW_MS) },
        now,
      ),
    ).toBe("ok");
  });

  it("stops a viewer at the daily limit", () => {
    expect(
      admitEvent(
        { eventsToday: DAILY_EVENT_LIMIT - 1, lastIdenticalAt: null },
        now,
      ),
    ).toBe("ok");
    expect(
      admitEvent(
        { eventsToday: DAILY_EVENT_LIMIT, lastIdenticalAt: null },
        now,
      ),
    ).toBe("limited");
  });
});

describe("retentionCutoff", () => {
  it("keeps a year of days", () => {
    expect(retentionCutoff(now)).toBe("2025-09-25");
  });
});
