import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { BoardCanvas } from "@/features/tactics/BoardCanvas";
import { BoardToolbar } from "@/features/tactics/BoardToolbar";
import {
  boardReducer,
  initialBoardState,
} from "@/features/tactics/board-state";
import { tacticsContent } from "@/features/tactics/content";
import type { Orientation } from "@/features/tactics/geometry";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

afterEach(cleanup);

const { board } = tacticsContent;
const EMPTY: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [],
  lines: [],
  steps: [],
};

/** The editor's board part: toolbar and canvas over one reducer. */
function Board({ orientation = "landscape" }: { orientation?: Orientation }) {
  const [state, dispatch] = useReducer(boardReducer, EMPTY, initialBoardState);
  return (
    <>
      <BoardToolbar state={state} dispatch={dispatch} />
      <BoardCanvas
        state={state}
        dispatch={dispatch}
        orientation={orientation}
        roster={[]}
      />
    </>
  );
}

/**
 * Lay the board out at ten pixels per metre from the page's top-left, so a
 * client position is `(metres + run-off) * 10`. jsdom has no layout.
 */
function layOut(orientation: Orientation = "landscape") {
  const svg = screen.getByRole("group", { name: board.pitch });
  const [width, height] = orientation === "landscape" ? [974, 590] : [590, 974];
  svg.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
    }) as DOMRect;
  return svg;
}

function position(name: string): string | null {
  return screen.getByRole("button", { name }).getAttribute("transform");
}

describe("tactics board", () => {
  it("places a player and moves it by dragging", () => {
    render(<Board />);
    const svg = layOut();

    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    const player = screen.getByRole("button", { name: "Heim 1" });
    expect(player).toHaveAttribute("aria-pressed", "true");
    expect(position("Heim 1")).toBe("translate(22.85 27.5)");

    // Grab the token 1 m right of its centre and drag: it keeps that offset.
    fireEvent.pointerDown(player, {
      pointerId: 1,
      button: 0,
      clientX: (22.85 + 3 + 1) * 10,
      clientY: (27.5 + 2) * 10,
    });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 400, clientY: 120 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 400, clientY: 120 });

    expect(position("Heim 1")).toBe("translate(36 10)");
  });

  it("nudges the selected player with the arrow keys", () => {
    render(<Board />);
    layOut();
    fireEvent.click(screen.getByRole("button", { name: board.addAway }));
    const player = screen.getByRole("button", { name: "Gast 1" });

    fireEvent.keyDown(player, { key: "ArrowUp" });
    fireEvent.keyDown(player, { key: "ArrowRight", shiftKey: true });
    expect(position("Gast 1")).toBe("translate(73.55 27)");

    fireEvent.keyDown(player, { key: "Delete" });
    expect(screen.queryByRole("button", { name: "Gast 1" })).toBeNull();
  });

  it("drags the way the pointer goes on a portrait board", () => {
    render(<Board orientation="portrait" />);
    const svg = layOut("portrait");
    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    const player = screen.getByRole("button", { name: "Heim 1" });

    // Portrait: u = y + 2, v = 94.4 - x.
    fireEvent.pointerDown(player, {
      pointerId: 1,
      button: 0,
      clientX: (27.5 + 2) * 10,
      clientY: (94.4 - 22.85) * 10,
    });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 100, clientY: 900 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 100, clientY: 900 });

    expect(position("Heim 1")).toBe("translate(4.4 8)");
  });

  it("draws an arrow by dragging in arrow mode", () => {
    render(<Board />);
    const svg = layOut();
    fireEvent.click(screen.getByRole("button", { name: board.modes.arrow }));

    fireEvent.pointerDown(svg, {
      pointerId: 2,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 300, clientY: 200 });
    fireEvent.pointerUp(svg, { pointerId: 2, clientX: 300, clientY: 200 });

    fireEvent.click(screen.getByRole("button", { name: board.modes.move }));
    expect(screen.getByRole("button", { name: "Pfeil 1" })).toBeInTheDocument();
  });

  it("switches to a short-corner quarter and back without moving anything", () => {
    render(<Board />);
    const svg = layOut();
    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    expect(svg).toHaveAttribute("viewBox", "0 0 97.4 59");

    const picker = screen.getByRole("combobox", { name: board.view });
    expect(picker).toHaveValue("full");
    fireEvent.change(picker, { target: { value: "corner-left" } });

    // The left quarter lies across the screen, its goal at the top. Heim 1
    // stands on the quarter line of the whole pitch, inside the quarter.
    expect(svg).toHaveAttribute("viewBox", "0 0 59 26.9");
    expect(position("Heim 1")).toBe("translate(22.85 27.5)");

    // A player added now lands inside the quarter.
    fireEvent.click(screen.getByRole("button", { name: board.addAway }));
    expect(position("Gast 1")).toBe("translate(10.45 31.5)");

    // A token outside the quarter is hidden, and back on the whole pitch.
    fireEvent.change(picker, { target: { value: "corner-right" } });
    expect(screen.queryByRole("button", { name: "Heim 1" })).toBeNull();
    fireEvent.change(picker, { target: { value: "full" } });
    expect(svg).toHaveAttribute("viewBox", "0 0 97.4 59");
    expect(position("Heim 1")).toBe("translate(22.85 27.5)");
    expect(position("Gast 1")).toBe("translate(10.45 31.5)");
  });
});
