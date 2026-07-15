import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Timecode } from "@/components/data/Timecode";
import { formatGameTime } from "@/components/data/format-timecode";

afterEach(cleanup);

describe("formatGameTime", () => {
  it("uses M:SS below an hour and pads seconds only", () => {
    expect(formatGameTime(0).main).toBe("0:00");
    expect(formatGameTime(9).main).toBe("0:09");
    expect(formatGameTime(75).main).toBe("1:15");
    expect(formatGameTime(724).main).toBe("12:04");
  });

  it("switches to H:MM:SS once past an hour", () => {
    expect(formatGameTime(3600).main).toBe("1:00:00");
    expect(formatGameTime(3802).main).toBe("1:03:22");
  });

  it("rounds hundredths without float drift", () => {
    expect(formatGameTime(12.07).hundredths).toBe("07");
    expect(formatGameTime(0.29).hundredths).toBe("29");
    expect(formatGameTime(5).hundredths).toBe("00");
  });

  it("clamps non-finite and negative offsets to zero", () => {
    expect(formatGameTime(-4).main).toBe("0:00");
    expect(formatGameTime(Number.NaN).main).toBe("0:00");
    expect(formatGameTime(Number.POSITIVE_INFINITY).main).toBe("0:00");
  });
});

describe("Timecode", () => {
  it("renders the formatted main readout", () => {
    render(<Timecode seconds={724} data-testid="tc" />);
    expect(screen.getByTestId("tc")).toHaveTextContent("12:04");
  });

  it("appends hundredths only when frac is set", () => {
    const { rerender } = render(<Timecode seconds={12.07} data-testid="tc" />);
    expect(screen.getByTestId("tc")).toHaveTextContent("0:12");
    expect(screen.getByTestId("tc")).not.toHaveTextContent(".07");
    rerender(<Timecode seconds={12.07} frac data-testid="tc" />);
    expect(screen.getByTestId("tc")).toHaveTextContent("0:12.07");
  });

  it("dims the readout when muted", () => {
    render(<Timecode seconds={0} muted data-testid="tc" />);
    expect(screen.getByTestId("tc").className).toContain(
      "text-[color:var(--text-muted)]",
    );
  });
});
