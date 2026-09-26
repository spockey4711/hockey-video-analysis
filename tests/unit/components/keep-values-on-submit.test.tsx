import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { keepValuesOnSubmit } from "@/components/forms/keep-values-on-submit";

afterEach(cleanup);

describe("keepValuesOnSubmit", () => {
  it("runs the action with the form's data and keeps the typed values", () => {
    const action = vi.fn();
    render(
      <form action={action} onSubmit={keepValuesOnSubmit(action)}>
        <label>
          Titel
          <input name="title" defaultValue="" />
        </label>
        <button type="submit">Senden</button>
      </form>,
    );

    const title = screen.getByLabelText("Titel");
    fireEvent.change(title, { target: { value: "Heim" } });
    fireEvent.click(screen.getByRole("button", { name: "Senden" }));

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0][0] as FormData).get("title")).toBe("Heim");
    expect(title).toHaveValue("Heim");
  });
});
