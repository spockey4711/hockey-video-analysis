import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Select } from "@/components/forms/Select";

afterEach(cleanup);

describe("Select", () => {
  it("renders string options as value and label", () => {
    render(<Select label="Viertel" options={["Q1", "Q2"]} />);
    const select = screen.getByLabelText<HTMLSelectElement>("Viertel");
    const options = Array.from(select.options).map((o) => [o.value, o.text]);
    expect(options).toEqual([
      ["Q1", "Q1"],
      ["Q2", "Q2"],
    ]);
  });

  it("renders value/label option objects", () => {
    render(
      <Select
        label="Sichtbarkeit"
        options={[
          { value: "team", label: "Team-weit" },
          { value: "single", label: "Einzeln" },
        ]}
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>("Sichtbarkeit");
    const options = Array.from(select.options).map((o) => [o.value, o.text]);
    expect(options).toEqual([
      ["team", "Team-weit"],
      ["single", "Einzeln"],
    ]);
  });

  it("calls onChange with the selected value", () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Viertel"
        options={["Q1", "Q2"]}
        defaultValue="Q1"
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>("Viertel");
    fireEvent.change(select, { target: { value: "Q2" } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(select.value).toBe("Q2");
  });
});
