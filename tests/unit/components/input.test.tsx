import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Input } from "@/components/forms/Input";

afterEach(cleanup);

describe("Input", () => {
  it("associates the label with the field", () => {
    render(<Input label="Titel" />);
    const field = screen.getByLabelText("Titel");
    expect(field.tagName).toBe("INPUT");
  });

  it("calls onChange as the user types", () => {
    const onChange = vi.fn();
    render(<Input label="Titel" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Halbfinale" },
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("marks the field invalid and wires the error to aria-describedby", () => {
    render(<Input label="Titel" error="Pflichtfeld" />);
    const field = screen.getByLabelText("Titel");
    expect(field).toHaveAttribute("aria-invalid", "true");
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Pflichtfeld",
    );
  });

  it("shows the hint when there is no error and hides it once an error appears", () => {
    const { rerender } = render(<Input label="Titel" hint="Optional" />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
    rerender(<Input label="Titel" hint="Optional" error="Pflichtfeld" />);
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
    expect(screen.getByText("Pflichtfeld")).toBeInTheDocument();
  });

  it("renders a leading icon when requested", () => {
    const { container } = render(<Input label="Suche" leading="search" />);
    expect(container.querySelector(".lucide-search")).not.toBeNull();
  });
});
