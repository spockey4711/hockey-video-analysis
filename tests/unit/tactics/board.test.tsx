import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BoardCanvas } from "@/features/tactics/BoardCanvas";
import { BoardToolbar } from "@/features/tactics/BoardToolbar";
import { SelectionPanel } from "@/features/tactics/SelectionPanel";
import {
  boardReducer,
  initialBoardState,
} from "@/features/tactics/board-state";
import { tacticsContent } from "@/features/tactics/content";
import type { Orientation } from "@/features/tactics/geometry";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";
import { useBoardClipboard } from "@/features/tactics/use-board-clipboard";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

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
  const clipboard = useBoardClipboard(state, dispatch);
  return (
    <div
      onKeyDown={(event) => {
        if (clipboard.onKeyDown(event)) event.preventDefault();
      }}
    >
      <BoardToolbar
        state={state}
        dispatch={dispatch}
        orientation={orientation}
        clipboard={clipboard}
      />
      <BoardCanvas
        state={state}
        dispatch={dispatch}
        orientation={orientation}
        roster={[]}
      />
    </div>
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

    fireEvent.click(
      screen.getByRole("button", {
        name: board.tool(board.modes.move, "v"),
      }),
    );
    expect(screen.getByRole("button", { name: "Pfeil 1" })).toBeInTheDocument();
  });

  it("holds an arrow level while Shift is down", () => {
    const { container } = render(<Board />);
    const svg = layOut();
    fireEvent.click(screen.getByRole("button", { name: board.modes.arrow }));

    fireEvent.pointerDown(svg, {
      pointerId: 2,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(svg, {
      pointerId: 2,
      clientX: 300,
      clientY: 130,
      shiftKey: true,
    });
    fireEvent.pointerUp(svg, {
      pointerId: 2,
      clientX: 300,
      clientY: 130,
      shiftKey: true,
    });

    const line = container.querySelector("[data-line-id] path");
    expect(line?.getAttribute("d")).toMatch(/^M7 8L27 8/);
  });

  it("draws a pass with its tool, names it, and rests the dotted toggle meanwhile", () => {
    render(<Board />);
    const svg = layOut();
    const dotted = screen.getByRole("button", { name: /Gepunktet/ });
    expect(dotted).toBeEnabled();

    fireEvent.click(
      screen.getByRole("button", { name: board.tool(board.modes.pass, "p") }),
    );
    expect(dotted).toBeDisabled();
    fireEvent.pointerDown(svg, {
      pointerId: 2,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 300, clientY: 200 });
    fireEvent.pointerUp(svg, { pointerId: 2, clientX: 300, clientY: 200 });

    fireEvent.click(
      screen.getByRole("button", { name: board.tool(board.modes.move, "v") }),
    );
    expect(dotted).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pass 1" })).toBeInTheDocument();
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

  it("mirrors the scene with buttons named by how the board lies", () => {
    const { unmount } = render(<Board />);
    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    fireEvent.click(
      screen.getByRole("button", { name: board.mirror.horizontal }),
    );
    expect(position("Heim 1")).toBe("translate(68.55 27.5)");
    unmount();

    // Upright, the pitch's length runs up the screen: left-right swaps the wings.
    render(<Board orientation="portrait" />);
    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Heim 2" }), {
      key: "ArrowLeft",
      shiftKey: true,
    });
    expect(position("Heim 2")).toBe("translate(22.85 22.5)");
    fireEvent.click(
      screen.getByRole("button", { name: board.mirror.horizontal }),
    );
    expect(position("Heim 2")).toBe("translate(22.85 32.5)");
  });

  it("offers only the wing swap on a short corner, its goal staying put", () => {
    const { unmount } = render(<Board scene={{ ...EMPTY, view: "corner" }} />);
    expect(
      screen.getByRole("button", { name: board.mirror.horizontal }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: board.mirror.vertical }),
    ).toBeNull();
    unmount();

    render(
      <Board orientation="portrait" scene={{ ...EMPTY, view: "corner" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: board.addAway }));
    expect(
      screen.queryByRole("button", { name: board.mirror.horizontal }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: board.mirror.vertical }),
    );
    expect(position("Gast 1")).toBe("translate(10.45 23.5)");
  });
});

describe("selecting several on the board", () => {
  const player = (id: string, label: string, x: number, y: number) => ({
    id,
    kind: "player" as const,
    team: "home" as const,
    label,
    playerId: null,
    x,
    y,
  });
  const SCENE: TacticsScene = {
    ...EMPTY,
    tokens: [
      player("p1", "1", 10, 10),
      player("p2", "2", 20, 10),
      player("p3", "3", 60, 40),
    ],
  };

  /** A pointer event at a pitch point on the landscape board laid out by `layOut`. */
  function on(x: number, y: number, extra: object = {}) {
    return {
      pointerId: 1,
      button: 0,
      pointerType: "mouse",
      clientX: (x + 3) * 10,
      clientY: (y + 2) * 10,
      ...extra,
    };
  }

  function pressed(name: string): string | null {
    return screen.getByRole("button", { name }).getAttribute("aria-pressed");
  }

  it("adds with Shift+click and drags the selection together", () => {
    render(<Board scene={SCENE} />);
    const svg = layOut();
    const one = screen.getByRole("button", { name: "Heim 1" });
    const two = screen.getByRole("button", { name: "Heim 2" });

    fireEvent.pointerDown(one, on(10, 10));
    fireEvent.pointerUp(svg, on(10, 10));
    fireEvent.pointerDown(two, on(20, 10, { shiftKey: true }));
    fireEvent.pointerUp(svg, on(20, 10));
    expect(pressed("Heim 1")).toBe("true");
    expect(pressed("Heim 2")).toBe("true");

    fireEvent.pointerDown(two, on(20, 10));
    fireEvent.pointerMove(svg, on(25, 20));
    fireEvent.pointerUp(svg, on(25, 20));
    expect(position("Heim 1")).toBe("translate(15 20)");
    expect(position("Heim 2")).toBe("translate(25 20)");
    expect(position("Heim 3")).toBe("translate(60 40)");

    // The arrow keys move them together too; Shift+click takes one out.
    fireEvent.keyDown(one, { key: "ArrowDown" });
    expect(position("Heim 2")).toBe("translate(25 20.5)");
    fireEvent.pointerDown(one, on(15, 20.5, { shiftKey: true }));
    expect(pressed("Heim 1")).toBe("false");
    expect(pressed("Heim 2")).toBe("true");
  });

  it("keeps a selection when focus follows the press on one of it", () => {
    render(<Board scene={SCENE} />);
    const svg = layOut();
    fireEvent.pointerDown(svg, on(5, 5));
    fireEvent.pointerMove(svg, on(25, 15));
    fireEvent.pointerUp(svg, on(25, 15));
    const one = screen.getByRole("button", { name: "Heim 1" });
    fireEvent.pointerDown(one, on(10, 10, { shiftKey: true }));
    fireEvent.focus(one);
    fireEvent.pointerUp(svg, on(10, 10));
    expect(pressed("Heim 1")).toBe("false");

    // Focus from the keyboard selects the item on its own.
    fireEvent.focus(screen.getByRole("button", { name: "Heim 3" }));
    expect(pressed("Heim 2")).toBe("false");
    expect(pressed("Heim 3")).toBe("true");
  });

  it("boxes in tokens with a mouse drag across the empty pitch", () => {
    const { container } = render(<Board scene={SCENE} />);
    const svg = layOut();

    fireEvent.pointerDown(svg, on(5, 5));
    fireEvent.pointerMove(svg, on(25, 15));
    expect(container.querySelector("[data-selection-box]")).toHaveAttribute(
      "width",
      "20",
    );
    fireEvent.pointerUp(svg, on(25, 15));

    expect(container.querySelector("[data-selection-box]")).toBeNull();
    // The pitch took focus, so the board's shortcuts reach it.
    expect(document.activeElement).toBe(svg);
    expect(pressed("Heim 1")).toBe("true");
    expect(pressed("Heim 2")).toBe("true");
    expect(pressed("Heim 3")).toBe("false");

    // A click on the empty pitch lets go of them.
    fireEvent.pointerDown(svg, on(50, 50));
    fireEvent.pointerUp(svg, on(50, 50));
    expect(pressed("Heim 1")).toBe("false");
  });

  it("leaves a finger on the empty pitch to scroll the page", () => {
    const { container } = render(<Board scene={SCENE} />);
    const svg = layOut();
    fireEvent.pointerDown(svg, on(5, 5, { pointerType: "touch" }));
    fireEvent.pointerMove(svg, on(25, 15, { pointerType: "touch" }));
    fireEvent.pointerUp(svg, on(25, 15, { pointerType: "touch" }));
    expect(container.querySelector("[data-selection-box]")).toBeNull();
    expect(pressed("Heim 1")).toBe("false");
  });

  it("still drags a single token with a finger", () => {
    render(<Board scene={SCENE} />);
    const svg = layOut();
    const touch = { pointerType: "touch" };
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Heim 3" }),
      on(60, 40, touch),
    );
    fireEvent.pointerMove(svg, on(50, 30, touch));
    fireEvent.pointerUp(svg, on(50, 30, touch));
    expect(position("Heim 3")).toBe("translate(50 30)");
    expect(pressed("Heim 3")).toBe("true");
    expect(pressed("Heim 1")).toBe("false");
  });

  it("counts a selection of several and removes it at once", () => {
    const dispatch = vi.fn();
    render(
      <SelectionPanel
        state={{
          ...initialBoardState(SCENE),
          selectedIds: ["p1", "p3"],
        }}
        dispatch={dispatch}
        roster={[]}
      />,
    );
    expect(screen.getByText(tacticsContent.panel.many(2))).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: tacticsContent.panel.removeAll }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: "remove", id: "p1" });
  });
});

describe("copying and pasting on the board", () => {
  it("copies with Ctrl+C and pastes beside it with Ctrl+V, in this board or the next", () => {
    const { unmount } = render(<Board />);
    const copy = screen.getByRole("button", { name: board.copy });
    const paste = screen.getByRole("button", { name: board.paste });
    expect(copy).toBeDisabled();
    expect(paste).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    const player = screen.getByRole("button", { name: "Heim 1" });
    fireEvent.keyDown(player, { key: "c", ctrlKey: true });
    expect(paste).toBeEnabled();
    fireEvent.keyDown(player, { key: "v", ctrlKey: true });

    const copies = screen.getAllByRole("button", { name: "Heim 1" });
    expect(copies.map((copy) => copy.getAttribute("transform"))).toEqual([
      "translate(22.85 27.5)",
      "translate(25.25 29.9)",
    ]);
    expect(copies[1]).toHaveAttribute("aria-pressed", "true");
    unmount();

    // Another scene of the same view takes it where it stood.
    render(<Board />);
    fireEvent.click(screen.getByRole("button", { name: board.paste }));
    expect(position("Heim 1")).toBe("translate(22.85 27.5)");
  });

  it("offers no paste on a board of another view", () => {
    const { unmount } = render(<Board />);
    fireEvent.click(screen.getByRole("button", { name: board.addHome }));
    fireEvent.click(screen.getByRole("button", { name: board.copy }));
    unmount();

    render(<Board scene={{ ...EMPTY, view: "corner" }} />);
    expect(screen.getByRole("button", { name: board.paste })).toBeDisabled();
  });
});
