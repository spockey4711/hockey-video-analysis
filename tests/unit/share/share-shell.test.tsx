import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShareShell } from "@/features/share/shell/ShareShell";
import {
  ShareEmptyState,
  ShareExpiredState,
  ShareLoading,
} from "@/features/share/shell/ShareStates";
import { shareContent } from "@/features/share/shell/content";

afterEach(cleanup);

describe("ShareShell", () => {
  it("frames children with the brand, private badge and footer note", () => {
    render(
      <ShareShell>
        <div data-testid="playlist">clips</div>
      </ShareShell>,
    );

    expect(screen.getByText(shareContent.shell.brand)).toBeInTheDocument();
    expect(
      screen.getByText(shareContent.shell.privateBadge),
    ).toBeInTheDocument();
    expect(screen.getByText(shareContent.shell.footerNote)).toBeInTheDocument();
    expect(screen.getByTestId("playlist")).toBeInTheDocument();
  });

  it("carries no coach navigation into the login-free surface", () => {
    render(
      <ShareShell>
        <div>clips</div>
      </ShareShell>,
    );

    // A secret-link recipient must not be able to hop into the coach app.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders the title as a heading and the subtitle when provided", () => {
    render(
      <ShareShell title="U16 weiblich" subtitle="Team-weite Clips">
        <div>clips</div>
      </ShareShell>,
    );

    expect(
      screen.getByRole("heading", { name: "U16 weiblich" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Team-weite Clips")).toBeInTheDocument();
  });

  it("omits the header block when neither title nor subtitle is set", () => {
    render(
      <ShareShell>
        <div>clips</div>
      </ShareShell>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("share state blocks", () => {
  it("shows the empty-link copy", () => {
    render(<ShareEmptyState />);
    expect(screen.getByText(shareContent.empty.title)).toBeInTheDocument();
    expect(screen.getByText(shareContent.empty.body)).toBeInTheDocument();
  });

  it("shows the expired-link copy with the status role", () => {
    render(<ShareExpiredState />);
    expect(screen.getByRole("status")).toHaveTextContent(
      shareContent.expired.title,
    );
    expect(screen.getByText(shareContent.expired.body)).toBeInTheDocument();
  });

  it("announces the loading state politely", () => {
    render(<ShareLoading />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(shareContent.loading.title);
  });
});
