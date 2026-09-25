import { describe, expect, it } from "vitest";

import {
  NAME_MAX_LENGTH,
  playerSetupContent,
  validatePlayer,
} from "@/features/players/setup";

const { errors } = playerSetupContent;

describe("validatePlayer", () => {
  it("trims the name and parses the jersey number", () => {
    expect(
      validatePlayer({ name: "  Alex Muster ", jerseyNumber: " 7 " }),
    ).toEqual({ ok: true, value: { name: "Alex Muster", jerseyNumber: 7 } });
  });

  it("treats an empty jersey number as none", () => {
    expect(
      validatePlayer({ name: "Kim Beispiel", jerseyNumber: "  " }),
    ).toEqual({
      ok: true,
      value: { name: "Kim Beispiel", jerseyNumber: null },
    });
  });

  it("requires a non-blank name", () => {
    expect(validatePlayer({ name: "   ", jerseyNumber: "" })).toEqual({
      ok: false,
      fieldErrors: { name: errors.nameRequired },
    });
  });

  it("caps the name length after trimming", () => {
    const atLimit = "a".repeat(NAME_MAX_LENGTH);
    expect(validatePlayer({ name: ` ${atLimit} `, jerseyNumber: "" }).ok).toBe(
      true,
    );
    expect(validatePlayer({ name: `${atLimit}a`, jerseyNumber: "" })).toEqual({
      ok: false,
      fieldErrors: { name: errors.nameTooLong },
    });
  });

  it("accepts jersey numbers from 1 to 99", () => {
    for (const value of ["1", "01", "42", "99"]) {
      expect(validatePlayer({ name: "Kim", jerseyNumber: value }).ok).toBe(
        true,
      );
    }
  });

  it.each(["0", "100", "-3", "+3", "7.5", "1e1", "abc", "0x1"])(
    "rejects the jersey number %s",
    (value) => {
      expect(validatePlayer({ name: "Kim", jerseyNumber: value })).toEqual({
        ok: false,
        fieldErrors: { jerseyNumber: errors.jerseyInvalid },
      });
    },
  );

  it("reports both field errors at once", () => {
    expect(validatePlayer({ name: "", jerseyNumber: "x" })).toEqual({
      ok: false,
      fieldErrors: {
        name: errors.nameRequired,
        jerseyNumber: errors.jerseyInvalid,
      },
    });
  });
});
