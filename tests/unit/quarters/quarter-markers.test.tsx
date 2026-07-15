import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { QuarterMarkers } from "@/features/quarters/QuarterMarkers";

afterEach(cleanup);

describe("QuarterMarkers", () => {
  it("draws one boundary marker per quarter, placed by start fraction", () => {
    const { container } = render(
      <QuarterMarkers
        quarters={[
          { index: 1, startS: 0, endS: 1800 },
          { index: 2, startS: 1800, endS: 3600 },
        ]}
        durationS={3600}
      />,
    );
    const markers = container.querySelectorAll("span");
    expect(markers).toHaveLength(2);
    expect((markers[1] as HTMLElement).style.left).toBe("50%");
  });

  it("renders nothing without a usable duration", () => {
    const { container } = render(
      <QuarterMarkers
        quarters={[{ index: 1, startS: 0, endS: 600 }]}
        durationS={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
