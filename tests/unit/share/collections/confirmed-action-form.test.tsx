import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmedActionForm } from "@/features/share/collections/ConfirmedActionForm";
import { collectionsContent } from "@/features/share/collections/content";
import type { CollectionMutationState } from "@/features/share/collections/state";

afterEach(cleanup);

const { detail } = collectionsContent.coach;
const COLLECTION_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function renderRotate(
  action = vi.fn(async (): Promise<CollectionMutationState> => ({
    status: "success",
  })),
) {
  render(
    <ConfirmedActionForm
      collectionId={COLLECTION_ID}
      action={action}
      copy={detail.rotate}
      icon="rewind"
      hint={detail.rotate.description}
      confirmVariant="primary"
    />,
  );
  return action;
}

describe("ConfirmedActionForm", () => {
  it("shows the trigger and its hint, and fires nothing on the first click", () => {
    const action = renderRotate();

    expect(screen.getByText(detail.rotate.description)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: detail.rotate.submit }));

    // The warning replaces the hint; the action waits for the real confirm.
    expect(screen.getByText(detail.rotate.confirm)).toBeInTheDocument();
    expect(
      screen.queryByText(detail.rotate.description),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: detail.rotate.confirmYes }),
    ).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("returns to the trigger when the coach cancels", () => {
    renderRotate();

    fireEvent.click(screen.getByRole("button", { name: detail.rotate.submit }));
    fireEvent.click(screen.getByRole("button", { name: detail.cancel }));

    expect(
      screen.getByRole("button", { name: detail.rotate.submit }),
    ).toBeInTheDocument();
    expect(screen.queryByText(detail.rotate.confirm)).not.toBeInTheDocument();
  });

  it("submits the collection id, reports success and can confirm again", async () => {
    const action = renderRotate();

    fireEvent.click(screen.getByRole("button", { name: detail.rotate.submit }));
    fireEvent.click(
      screen.getByRole("button", { name: detail.rotate.confirmYes }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        detail.rotate.success,
      ),
    );
    const formData = action.mock.calls[0]?.at(1) as FormData | undefined;
    expect(formData?.get("collectionId")).toBe(COLLECTION_ID);

    // A second rotation must not need a page reload.
    fireEvent.click(screen.getByRole("button", { name: detail.rotate.submit }));
    expect(screen.getByText(detail.rotate.confirm)).toBeInTheDocument();
  });

  it("shows the action's error", async () => {
    renderRotate(
      vi.fn(async (): Promise<CollectionMutationState> => ({
        status: "error",
        error: "Nicht gefunden.",
      })),
    );

    fireEvent.click(screen.getByRole("button", { name: detail.rotate.submit }));
    fireEvent.click(
      screen.getByRole("button", { name: detail.rotate.confirmYes }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Nicht gefunden."),
    );
  });
});
