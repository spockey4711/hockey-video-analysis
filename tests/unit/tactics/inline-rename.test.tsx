import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineRename } from "@/features/tactics/InlineRename";
import { tacticsContent } from "@/features/tactics/content";
import type { SceneMutationState } from "@/features/tactics/state";

const { rename, errors } = tacticsContent;
const SCENE_ID = "11111111-1111-4111-8111-111111111111";
const OPEN = rename.scene("Ecke kurz");

afterEach(cleanup);

function renderRename(
  action: (
    prev: SceneMutationState,
    data: FormData,
  ) => Promise<SceneMutationState>,
  title = false,
) {
  return render(
    <InlineRename
      idField="sceneId"
      id={SCENE_ID}
      name="Ecke kurz"
      action={action}
      fieldLabel="Name der Szene"
      openLabel={OPEN}
      title={title}
    >
      <h1>Ecke kurz</h1>
    </InlineRename>,
  );
}

function field(): HTMLInputElement {
  return screen.getByRole("textbox", { name: "Name der Szene" });
}

describe("InlineRename", () => {
  it("shows the name with a pencil button and no field", () => {
    renderRename(vi.fn());
    expect(screen.getByRole("heading", { name: "Ecke kurz" })).toBeTruthy();
    expect(screen.getByRole("button", { name: OPEN })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("labels the pencil in the editor title", () => {
    renderRename(vi.fn(), true);
    expect(screen.getByRole("button", { name: OPEN })).toHaveTextContent(
      rename.open,
    );
  });

  it("opens a focused field with the current name and cancels on Escape", () => {
    const action = vi.fn();
    renderRename(action);

    fireEvent.click(screen.getByRole("button", { name: OPEN }));
    expect(field()).toHaveValue("Ecke kurz");
    expect(field()).toHaveFocus();
    expect(screen.queryByRole("heading")).toBeNull();

    fireEvent.change(field(), { target: { value: "Ecke lang" } });
    fireEvent.keyDown(field(), { key: "Escape" });

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("heading", { name: "Ecke kurz" })).toBeTruthy();
    expect(screen.getByRole("button", { name: OPEN })).toHaveFocus();
    expect(action).not.toHaveBeenCalled();
  });

  it("cancels with the cancel button, and a reopened field starts fresh", () => {
    renderRename(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: OPEN }));
    fireEvent.change(field(), { target: { value: "Entwurf" } });
    fireEvent.click(screen.getByRole("button", { name: rename.cancel }));

    fireEvent.click(screen.getByRole("button", { name: OPEN }));
    expect(field()).toHaveValue("Ecke kurz");
  });

  it("sends the id and the new name, then closes on success", async () => {
    const action = vi.fn(async () => ({ status: "success" as const }));
    renderRename(action);

    fireEvent.click(screen.getByRole("button", { name: OPEN }));
    fireEvent.change(field(), { target: { value: "Ecke lang" } });
    fireEvent.click(screen.getByRole("button", { name: rename.save }));

    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(action).toHaveBeenCalledTimes(1);
    const sent = action.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("sceneId")).toBe(SCENE_ID);
    expect(sent[1].get("name")).toBe("Ecke lang");
    expect(screen.getByRole("button", { name: OPEN })).toHaveFocus();
  });

  it("keeps the field open with the refusal beside it", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      error: errors.invalidName,
    }));
    renderRename(action);

    fireEvent.click(screen.getByRole("button", { name: OPEN }));
    fireEvent.change(field(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: rename.save }));

    await waitFor(() =>
      expect(field()).toHaveAttribute("aria-invalid", "true"),
    );
    expect(screen.getByText(errors.invalidName)).toBeTruthy();

    // A cancelled rename's refusal never greets the next one.
    fireEvent.keyDown(field(), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: OPEN }));
    expect(screen.queryByText(errors.invalidName)).toBeNull();
  });
});
