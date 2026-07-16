import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Switch } from "@/components/forms/Switch";

afterEach(cleanup);

describe("Switch", () => {
  it("exposes the switch role and reflects the checked state", () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    rerender(<Switch checked onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the negated state", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} />);
    screen.getByRole("switch").click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles when its label is clicked", () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Team-weit" />);
    screen.getByText("Team-weit").click();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not fire onChange while disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} disabled />);
    screen.getByRole("switch").click();
    expect(onChange).not.toHaveBeenCalled();
  });
});
