import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Impressum, PrivacyPolicy, legalContent } from "@/features/legal";
import type { LegalOperator } from "@/features/legal/operator";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const { impressum, missing, privacy } = legalContent;

const OPERATOR: LegalOperator = {
  name: "Max Mustermann",
  street: "Musterstraße 1",
  city: "12345 Musterstadt",
  email: "kontakt@example.com",
  phone: null,
  hostingProvider: null,
  missing: [],
};

const UNSET: LegalOperator = {
  name: null,
  street: null,
  city: null,
  email: null,
  phone: null,
  hostingProvider: null,
  missing: [
    "LEGAL_OPERATOR_NAME",
    "LEGAL_OPERATOR_STREET",
    "LEGAL_OPERATOR_CITY",
    "LEGAL_CONTACT_EMAIL",
  ],
};

describe("Impressum", () => {
  it("renders the operator's address and a mailto contact", () => {
    render(<Impressum operator={OPERATOR} />);

    expect(
      screen.getByRole("heading", { level: 1, name: impressum.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Max Mustermann")).not.toHaveLength(0);
    expect(screen.getAllByText("12345 Musterstadt")).not.toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "kontakt@example.com" }),
    ).toHaveAttribute("href", "mailto:kontakt@example.com");
    expect(screen.queryByText(`${impressum.phoneLabel}:`)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the phone line only when one is configured", () => {
    render(<Impressum operator={{ ...OPERATOR, phone: "+49 000 000000" }} />);

    expect(screen.getByText("+49 000 000000")).toBeInTheDocument();
  });

  it("names the unset variables outside production", () => {
    render(<Impressum operator={UNSET} />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(missing.title);
    for (const name of UNSET.missing) {
      expect(within(notice).getByText(name)).toBeInTheDocument();
    }
  });

  it("hides the variable names from production visitors", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<Impressum operator={UNSET} />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(missing.body);
    expect(notice).not.toHaveTextContent("LEGAL_OPERATOR_NAME");
  });
});

describe("PrivacyPolicy", () => {
  it("renders the controller and every policy section", () => {
    render(<PrivacyPolicy operator={OPERATOR} />);

    expect(
      screen.getByRole("heading", { level: 1, name: privacy.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(privacy.updated)).toBeInTheDocument();
    expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    for (const section of privacy.sections(null)) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.heading }),
      ).toBeInTheDocument();
    }
  });

  it("describes the hosting generically when no hoster is configured", () => {
    render(<PrivacyPolicy operator={OPERATOR} />);

    expect(
      screen.getByText(/bei einem Hosting-Anbieter angemietet/),
    ).toBeInTheDocument();
  });

  it("names the hoster when one is configured", () => {
    render(
      <PrivacyPolicy
        operator={{ ...OPERATOR, hostingProvider: "Beispiel Hosting GmbH" }}
      />,
    );

    expect(
      screen.getByText(/Server bei Beispiel Hosting GmbH\./),
    ).toBeInTheDocument();
  });
});
