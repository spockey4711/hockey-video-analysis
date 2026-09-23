import { describe, expect, it } from "vitest";

import { buttonClassName } from "@/components/forms/button-styles";

describe("buttonClassName", () => {
  it("defaults to the primary, medium button look", () => {
    const classes = buttonClassName();
    expect(classes).toContain("bg-[var(--accent)]");
    expect(classes).toContain("h-[var(--control-md)]");
    expect(classes).not.toContain("w-full");
  });

  it("switches variant, size and full width", () => {
    const classes = buttonClassName({
      variant: "secondary",
      size: "sm",
      full: true,
    });
    expect(classes).toContain("bg-[var(--surface-raised)]");
    expect(classes).toContain("h-[var(--control-sm)]");
    expect(classes).toContain("w-full");
    expect(classes).not.toContain("bg-[var(--accent)]");
  });
});
