import { describe, expect, it } from "vitest";

import { formatCommentDate } from "@/features/clips/comments/format-comment-date";

describe("formatCommentDate", () => {
  it("formats an ISO timestamp as a German date and time", () => {
    expect(formatCommentDate("2026-09-22T14:05:00Z", "UTC")).toBe(
      "22.09.2026, 14:05",
    );
  });

  it("renders in the requested time zone", () => {
    expect(formatCommentDate("2026-09-22T14:05:00Z", "Europe/Berlin")).toBe(
      "22.09.2026, 16:05",
    );
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatCommentDate("not a date")).toBe("");
  });
});
