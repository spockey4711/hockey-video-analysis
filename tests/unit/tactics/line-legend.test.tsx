import { cleanup, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AudienceBoard } from "@/features/share/presentation/AudienceBoard";
import { LineLegend } from "@/features/tactics/LineLegend";
import { SceneStage, type SceneControl } from "@/features/tactics/SceneStage";
import { tacticsContent } from "@/features/tactics/content";
import {
  SCENE_VERSION,
  type BoardLine,
  type LineTool,
  type TacticsScene,
} from "@/features/tactics/scene";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const { board } = tacticsContent;

function line(id: string, tool: LineTool, step = 0): BoardLine {
  return {
    id,
    tool,
    color: "white",
    width: "medium",
    style: tool === "run" ? "dotted" : "solid",
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 20 },
    ],
    step,
  };
}

function legendNames(): string[] {
  const legend = screen.getByRole("list", { name: board.legend });
  return within(legend)
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("LineLegend", () => {
  it("names each play tool the lines use once, in the tools' order", () => {
    render(
      <LineLegend
        lines={[
          line("l1", "block"),
          line("l2", "arrow"),
          line("l3", "pass", 2),
          line("l4", "block"),
          line("l5", "dribble"),
        ]}
      />,
    );
    expect(legendNames()).toEqual([
      board.modes.pass,
      board.modes.dribble,
      board.modes.block,
    ]);
  });

  it("draws each entry's sample in the look of its line", () => {
    render(<LineLegend lines={[line("l1", "run"), line("l2", "block")]} />);
    const [run, block] = screen.getAllByRole("listitem");
    // The run's shaft is dotted and ends in a head; the block's is solid
    // and ends in an open bar.
    const runPaths = run?.querySelectorAll("path") ?? [];
    expect(runPaths[0]?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(runPaths[1]?.getAttribute("fill")).toBeNull();
    const blockPaths = block?.querySelectorAll("path") ?? [];
    expect(blockPaths[0]?.getAttribute("stroke-dasharray")).toBeNull();
    expect(blockPaths[1]?.getAttribute("fill")).toBe("none");
  });

  it("shows nothing for a scene without play lines", () => {
    const { container } = render(
      <LineLegend lines={[line("l1", "arrow"), line("l2", "curve")]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the legend on a scene's stage", () => {
  const scene: TacticsScene = {
    version: SCENE_VERSION,
    view: "full",
    tokens: [],
    lines: [line("l1", "run"), line("l2", "dribble", 1)],
    steps: [{ duration: 1, moves: [] }],
  };

  it("names every play line of the scene, whichever step is on show", () => {
    render(
      <SceneStage
        scene={scene}
        holdS={8}
        title="Konter"
        controlRef={createRef<SceneControl>()}
      />,
    );
    expect(legendNames()).toEqual([board.modes.run, board.modes.dribble]);
  });

  it("names them on the projector's board too", () => {
    // The board reads the screen's orientation; jsdom has no media queries.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    render(
      <AudienceBoard board={{ scene, step: 0, playback: null, draft: null }} />,
    );
    expect(legendNames()).toEqual([board.modes.run, board.modes.dribble]);
  });
});
