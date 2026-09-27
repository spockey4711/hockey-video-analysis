import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/share/collections/actions", () => ({
  setShareExpiryAction: vi.fn(),
}));

import { ShareExpiryForm } from "@/features/share/collections/ShareExpiryForm";
import { collectionsContent } from "@/features/share/collections/content";

const { expiry } = collectionsContent.coach.detail;
const COLLECTION_ID = "11111111-1111-4111-8111-111111111111";

afterEach(cleanup);

describe("ShareExpiryForm", () => {
  it("offers an optional day from today on while the link has no end date", () => {
    render(
      <ShareExpiryForm
        collectionId={COLLECTION_ID}
        endDate={null}
        expired={false}
        today="2026-10-12"
      />,
    );
    const field = screen.getByLabelText(expiry.label);
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("min", "2026-10-12");
    expect(screen.getByText(expiry.none)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: expiry.remove })).toBeNull();
  });

  it("shows the end date still ahead, with a remove button", () => {
    render(
      <ShareExpiryForm
        collectionId={COLLECTION_ID}
        endDate="2026-10-31"
        expired={false}
        today="2026-10-12"
      />,
    );
    expect(screen.getByLabelText(expiry.label)).toHaveValue("2026-10-31");
    expect(screen.getByText(expiry.until("31.10.2026"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: expiry.remove })).toHaveAttribute(
      "value",
      "remove",
    );
  });

  it("says when the end date has passed and the link no longer works", () => {
    render(
      <ShareExpiryForm
        collectionId={COLLECTION_ID}
        endDate="2026-10-01"
        expired
        today="2026-10-12"
      />,
    );
    expect(screen.getByText(expiry.expired("01.10.2026"))).toBeInTheDocument();
  });
});
