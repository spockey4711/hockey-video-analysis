import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ saveTagWindowsAction: vi.fn() }));
vi.mock("@/features/tag-windows/actions", () => actions);

import { TagWindowsForm } from "@/features/tag-windows";
import { tagWindowsContent } from "@/features/tag-windows/content";
import { DEFAULT_TAG_WINDOWS, resolveTagWindows } from "@/lib/tag-types";

const content = tagWindowsContent;
const teamWindows = resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]);

beforeEach(() => {
  actions.saveTagWindowsAction.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function field(typeLabel: string, edgeLabel: string): HTMLInputElement {
  return screen.getByRole("spinbutton", {
    name: content.fieldName(typeLabel, edgeLabel),
  });
}

function formValues(): Record<string, string> {
  const form = document.querySelector("form");
  if (!form) throw new Error("no form");
  return Object.fromEntries(
    [...new FormData(form).entries()].map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}

describe("TagWindowsForm", () => {
  it("shows each type's stored window with its default beside it", () => {
    render(<TagWindowsForm windows={teamWindows} />);

    expect(field("Tor", content.preLabel)).toHaveValue(15);
    expect(field("Tor", content.postLabel)).toHaveValue(5);
    expect(field("Ecke kurz", content.preLabel)).toHaveValue(
      DEFAULT_TAG_WINDOWS.corner_short.preS,
    );
    expect(
      screen.getByText(content.defaultHint(DEFAULT_TAG_WINDOWS.goal)),
    ).toBeInTheDocument();
  });

  it("submits the edited windows under their field names", () => {
    render(<TagWindowsForm windows={DEFAULT_TAG_WINDOWS} />);

    fireEvent.change(field("Tor", content.preLabel), {
      target: { value: "15" },
    });

    expect(formValues()).toMatchObject({
      "goal.preS": "15",
      "goal.postS": "5",
    });
    expect(screen.getByRole("button", { name: content.submit })).toBeEnabled();
  });

  it("keeps Zurücksetzen off while every window is on its default", () => {
    render(<TagWindowsForm windows={DEFAULT_TAG_WINDOWS} />);
    expect(screen.getByRole("button", { name: content.reset })).toBeDisabled();
  });

  it("resets to the defaults through the action", async () => {
    actions.saveTagWindowsAction.mockResolvedValue({ success: "reset" });
    render(<TagWindowsForm windows={teamWindows} />);

    fireEvent.click(screen.getByRole("button", { name: content.reset }));

    await waitFor(() =>
      expect(actions.saveTagWindowsAction).toHaveBeenCalledOnce(),
    );
    const data = actions.saveTagWindowsAction.mock.calls[0]![1] as FormData;
    expect(data.get("intent")).toBe("reset");
    expect(field("Tor", content.preLabel)).toHaveValue(
      DEFAULT_TAG_WINDOWS.goal.preS,
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      content.resetSuccess,
    );
  });

  it("shows the field errors the action returns", async () => {
    actions.saveTagWindowsAction.mockResolvedValue({
      error: content.problems.summary,
      fieldErrors: { "goal.preS": content.problems.preS },
    });
    render(<TagWindowsForm windows={DEFAULT_TAG_WINDOWS} />);

    fireEvent.submit(document.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      content.problems.summary,
    );
    expect(field("Tor", content.preLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText(content.problems.preS)).toBeInTheDocument();
  });
});
