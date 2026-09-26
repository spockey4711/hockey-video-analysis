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
function Board({
  orientation = "landscape",
  scene = EMPTY,
}: {
  orientation?: Orientation;
  scene?: TacticsScene;
}) {
  const [state, dispatch] = useReducer(boardReducer, scene, initialBoardState);
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

  it("shows a short-corner scene's quarter and names its view, which it cannot change", () => {
    render(<Board scene={{ ...EMPTY, view: "corner" }} />);
    const svg = layOut();

    // The quarter lies across the screen, its goal at the top.
    expect(svg).toHaveAttribute("viewBox", "0 0 59 26.9");
    expect(
      screen.getByRole("toolbar", { name: board.toolbar }),
    ).toHaveTextContent(board.views.corner);
    expect(screen.queryByRole("combobox")).toBeNull();

    // A player added now lands inside the quarter.
    fireEvent.click(screen.getByRole("button", { name: board.addAway }));
    expect(position("Gast 1")).toBe("translate(10.45 31.5)");
  });

  it("draws five defenders in a short-corner goal apart and grabs the nearest", () => {
    // The keeper and four defenders on the goal-line, 0.73 m apart.
    const tokens = [-2, -1, 0, 1, 2].map((slot) => ({
      id: `d${slot + 2}`,
      kind: "player" as const,
      team: "away" as const,
      label: String(slot + 3),
      playerId: null,
      x: 0.5,
      y: 27.5 + slot * 0.73,
    }));
    render(<Board scene={{ ...EMPTY, view: "corner", tokens }} />);
    const svg = layOut();
    // The quarter at ten pixels per metre.
    svg.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 590,
        height: 269,
        right: 590,
        bottom: 269,
      }) as DOMRect;

    const disc = screen
      .getByRole("button", { name: "Gast 3" })
      .querySelector("circle:not(.fill-transparent)");
    expect(disc).toHaveAttribute("r", "0.3");

    // Landscape corner: u = 57 - y, v = x + 3. Grab 0.3 m off the middle
    // defender towards its neighbour: the middle one moves, not the neighbour.
    fireEvent.pointerDown(svg, {
      pointerId: 1,
      button: 0,
      clientX: (57 - (27.5 + 0.3)) * 10,
      clientY: (0.5 + 3) * 10,
    });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 200, clientY: 100 });

    expect(position("Gast 3")).toBe("translate(7 36.7)");
    expect(position("Gast 4")).toBe("translate(0.5 28.23)");
  });

  it("names the whole-pitch view of a full scene", () => {
    render(<Board />);
    expect(
      screen.getByRole("toolbar", { name: board.toolbar }),
    ).toHaveTextContent(board.views.full);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
