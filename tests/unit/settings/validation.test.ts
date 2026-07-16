import { describe, expect, it } from "vitest";

import { validatePasswordChange } from "@/features/settings/validation";

describe("validatePasswordChange", () => {
  it("accepts a valid change to a different password", () => {
    expect(
      validatePasswordChange({
        current: "old-secret",
        next: "brand-new-secret",
        confirm: "brand-new-secret",
      }),
    ).toEqual({});
  });

  it("requires the current password", () => {
    const errors = validatePasswordChange({
      current: "",
      next: "brand-new-secret",
      confirm: "brand-new-secret",
    });
    expect(errors.current).toBeDefined();
  });

  it("rejects a too-short new password", () => {
    const errors = validatePasswordChange({
      current: "old-secret",
      next: "short",
      confirm: "short",
    });
    expect(errors.next).toBeDefined();
  });

  it("rejects a mismatched confirmation", () => {
    const errors = validatePasswordChange({
      current: "old-secret",
      next: "brand-new-secret",
      confirm: "different-secret",
    });
    expect(errors.confirm).toBeDefined();
  });

  it("rejects a new password equal to the current one", () => {
    const errors = validatePasswordChange({
      current: "same-secret-12",
      next: "same-secret-12",
      confirm: "same-secret-12",
    });
    expect(errors.next).toBeDefined();
  });

  it("reports the strength error before the mismatch when both fail", () => {
    const errors = validatePasswordChange({
      current: "old-secret",
      next: "short",
      confirm: "mismatch",
    });
    expect(errors.next).toBeDefined();
    expect(errors.confirm).toBeUndefined();
  });
});
