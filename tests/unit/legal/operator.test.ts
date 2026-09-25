import { afterEach, describe, expect, it, vi } from "vitest";

import {
  REQUIRED_OPERATOR_ENV,
  getLegalOperator,
} from "@/features/legal/operator";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubComplete(): void {
  vi.stubEnv("LEGAL_OPERATOR_NAME", "Max Mustermann");
  vi.stubEnv("LEGAL_OPERATOR_STREET", "Musterstraße 1");
  vi.stubEnv("LEGAL_OPERATOR_CITY", "12345 Musterstadt");
  vi.stubEnv("LEGAL_CONTACT_EMAIL", "kontakt@example.com");
}

describe("getLegalOperator", () => {
  it("reads the operator details from the environment", () => {
    stubComplete();
    vi.stubEnv("LEGAL_CONTACT_PHONE", "+49 000 000000");
    vi.stubEnv("LEGAL_HOSTING_PROVIDER", "Beispiel Hosting GmbH");

    expect(getLegalOperator()).toEqual({
      name: "Max Mustermann",
      street: "Musterstraße 1",
      city: "12345 Musterstadt",
      email: "kontakt@example.com",
      phone: "+49 000 000000",
      hostingProvider: "Beispiel Hosting GmbH",
      missing: [],
    });
  });

  it("lists every unset required variable and nulls the optional ones", () => {
    for (const name of REQUIRED_OPERATOR_ENV) vi.stubEnv(name, "");
    vi.stubEnv("LEGAL_CONTACT_PHONE", "");
    vi.stubEnv("LEGAL_HOSTING_PROVIDER", "");

    const operator = getLegalOperator();

    expect(operator.missing).toEqual([...REQUIRED_OPERATOR_ENV]);
    expect(operator.phone).toBeNull();
    expect(operator.hostingProvider).toBeNull();
  });

  it("trims values and treats a blank one as unset", () => {
    stubComplete();
    vi.stubEnv("LEGAL_OPERATOR_NAME", "  Max Mustermann  ");
    vi.stubEnv("LEGAL_OPERATOR_CITY", "   ");

    const operator = getLegalOperator();

    expect(operator.name).toBe("Max Mustermann");
    expect(operator.city).toBeNull();
    expect(operator.missing).toEqual(["LEGAL_OPERATOR_CITY"]);
  });
});
