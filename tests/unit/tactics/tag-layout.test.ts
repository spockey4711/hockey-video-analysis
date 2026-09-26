import { describe, expect, it } from "vitest";

import { tagRows, uprightPoint } from "@/features/tactics/tag-layout";

// Tags about 1 m high: a name of seven characters is about 4.3 m wide.
const FONT = 1;

describe("uprightPoint", () => {
  it("turns a board point back the way its labels turn", () => {
    expect(uprightPoint({ x: 2, y: 5 }, "none")).toEqual({ x: 2, y: 5 });
    expect(uprightPoint({ x: 2, y: 5 }, "left")).toEqual({ x: 5, y: -2 });
    expect(uprightPoint({ x: 2, y: 5 }, "right")).toEqual({ x: -5, y: 2 });
  });
});

describe("tagRows", () => {
  it("keeps tags far apart right under their discs", () => {
    const rows = tagRows(
      [
        { id: "a", at: { x: 0, y: 0 }, text: "Mila B." },
        { id: "b", at: { x: 10, y: 0 }, text: "Nora" },
      ],
      "none",
      FONT,
    );
    expect([...rows]).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });

  it("drops a tag that would run into its neighbour's a row lower", () => {
    // Four defenders side by side in the goal, closer than a name is wide.
    const rows = tagRows(
      [0, 1, 2, 3].map((index) => ({
        id: `d${index}`,
        at: { x: index * 2.5, y: 0 },
        text: "Mila B.",
      })),
      "none",
      FONT,
    );
    expect([...rows.values()]).toEqual([0, 1, 0, 1]);
  });

  it("lays tags out as the screen shows them on a turned board", () => {
    // Side by side across the screen once the board is turned left.
    const tags = [
      { id: "a", at: { x: 0, y: 0 }, text: "Mila B." },
      { id: "b", at: { x: 0, y: 2.5 }, text: "Mila M." },
    ];
    expect([...tagRows(tags, "left", FONT).values()]).toEqual([0, 1]);
    // Stacked one under the other on an unturned board: no clash.
    expect([...tagRows(tags, "none", FONT).values()]).toEqual([0, 0]);
  });
});
