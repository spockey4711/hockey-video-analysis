import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toSceneItem } from "@/features/share/collections/clip-items";
import {
  audienceBoard,
  audienceEntries,
} from "@/features/share/presentation/audience-protocol";
import { BoardImage } from "@/features/tactics/BoardImage";
import { SceneEditor } from "@/features/tactics/SceneEditor";
import { TokenTags } from "@/features/tactics/TokenGlyph";
import { keyframe } from "@/features/tactics/animation";
import { initialBoardState } from "@/features/tactics/board-state";
import { clipOf } from "@/features/tactics/clipboard";
import { tacticsContent } from "@/features/tactics/content";
import { formationFromScene } from "@/features/tactics/formation";
import { shortNames, tokenNames } from "@/features/tactics/labels";
import type { BoardRosterPlayer } from "@/features/tactics/queries";
import {
  SCENE_VERSION,
  withoutRosterLinks,
  type PlayerToken,
  type TacticsScene,
} from "@/features/tactics/scene";
import { boardSizes, tagFontSize } from "@/features/tactics/token-size";
import { BOARD_NAMES_STORAGE_KEY } from "@/features/tactics/use-board-names";

// The editor's forms post to server actions; the board never calls them here.
vi.mock("@/features/tactics/actions", () => ({
  saveSceneAction: vi.fn(),
  duplicateSceneAction: vi.fn(),
  deleteSceneAction: vi.fn(),
}));
vi.mock("@/features/tactics/formation-actions", () => ({
  saveSceneAsFormationAction: vi.fn(),
}));

const { board } = tacticsContent;

// A made-up roster: two share a first name, one of those two a last initial
// with a third.
const MILA_B = "11111111-1111-4111-8111-111111111111";
const MILA_M = "22222222-2222-4222-8222-222222222222";
const NORA = "33333333-3333-4333-8333-333333333333";
const MARA = "44444444-4444-4444-8444-444444444444";
const ROSTER: BoardRosterPlayer[] = [
  { id: MILA_B, name: "Mila Beispiel", jerseyNumber: 7 },
  { id: MILA_M, name: "Mila Muster", jerseyNumber: 9 },
  { id: NORA, name: "Nora Muster", jerseyNumber: null },
  { id: MARA, name: "Mara", jerseyNumber: 3 },
];

function player(id: string, over: Partial<PlayerToken> = {}): PlayerToken {
  return {
    id,
    kind: "player",
    team: "home",
    label: "1",
    position: "",
    playerId: null,
    x: 10,
    y: 20,
    ...over,
  };
}

/** Heim 7 linked to Mila Beispiel as left back, a free token as keeper, and the ball. */
const SCENE: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [
    player("p1", { label: "7", position: "LV", playerId: MILA_B }),
    player("p2", { label: "1", position: "TW", x: 3, y: 27.5 }),
    { id: "b1", kind: "ball", x: 45.7, y: 27.5 },
  ],
  lines: [],
  shapes: [],
  steps: [],
};

beforeEach(() => {
  // jsdom has no media queries; the board lies in landscape.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("shortNames", () => {
  it("uses the first name, then the last initial, then the whole name", () => {
    const names = shortNames([
      ...ROSTER,
      { id: "x", name: "Mila  Martens ", jerseyNumber: null },
    ]);
    expect(names.get(MILA_B)).toBe("Mila B.");
    // Mila Muster and Mila Martens share "Mila M.", so both go by full name.
    expect(names.get(MILA_M)).toBe("Mila Muster");
    expect(names.get("x")).toBe("Mila  Martens");
    expect(names.get(NORA)).toBe("Nora");
    expect(names.get(MARA)).toBe("Mara");
  });
});

describe("tokenNames", () => {
  it("names only tokens linked to a player on the roster", () => {
    const scene = {
      ...SCENE,
      tokens: [
        ...SCENE.tokens,
        player("p3", { playerId: "55555555-5555-4555-8555-555555555555" }),
      ],
    };
    expect([...tokenNames(scene.tokens, ROSTER)]).toEqual([["p1", "Mila B."]]);
  });

  it("names nobody without a roster, as on every login-free page", () => {
    expect(tokenNames(SCENE.tokens, []).size).toBe(0);
  });
});

describe("the tags under the discs", () => {
  function tag(container: HTMLElement) {
    return container.querySelector("[data-token-tag]");
  }

  it("shows the position code alone, or with the name", () => {
    const sizes = boardSizes("full");
    const token = player("p1", { position: "LV" });
    const { container, rerender } = render(
      <svg>
        <TokenTags tokens={[token]} turn="none" sizes={sizes} pxPerMetre={10} />
      </svg>,
    );
    expect(tag(container)?.textContent).toBe("LV");
    rerender(
      <svg>
        <TokenTags
          tokens={[token]}
          names={new Map([["p1", "Mila"]])}
          turn="none"
          sizes={sizes}
          pxPerMetre={10}
        />
      </svg>,
    );
    expect(tag(container)?.textContent).toBe("LV Mila");
  });

  it("draws nothing under a disc without a code or a name, nor under the ball", () => {
    const { container } = render(
      <svg>
        <TokenTags
          tokens={[player("p1"), { id: "b1", kind: "ball", x: 1, y: 1 }]}
          turn="none"
          sizes={boardSizes("full")}
          pxPerMetre={10}
        />
      </svg>,
    );
    expect(tag(container)).toBeNull();
  });

  it("hangs below a short corner's small disc, turned upright with the board", () => {
    const sizes = boardSizes("corner");
    const { container } = render(
      <svg>
        <TokenTags
          tokens={[player("p1")]}
          names={new Map([["p1", "Mila"]])}
          turn="left"
          sizes={sizes}
          pxPerMetre={20}
        />
      </svg>,
    );
    const text = tag(container);
    expect(text?.getAttribute("transform")).toBe("rotate(90)");
    const fontSize = Number(text?.getAttribute("font-size"));
    // At least ten pixels on screen, though the quarter's own size is less.
    expect(fontSize * 20).toBeCloseTo(sizes.tagMinPx);
    expect(Number(text?.getAttribute("y"))).toBeGreaterThan(
      sizes.player + fontSize / 2,
    );
  });

  it("keeps a readable size on a phone and grows no smaller than the view's own", () => {
    const full = boardSizes("full");
    expect(tagFontSize(full, 0)).toBe(full.tag);
    // A turned phone shows the whole pitch at about six pixels a metre.
    expect(tagFontSize(full, 6) * 6).toBeCloseTo(full.tagMinPx);
    expect(tagFontSize(full, 100)).toBe(full.tag);
  });
});

describe("the names switch on the coach's board", () => {
  function renderEditor(roster: readonly BoardRosterPlayer[] = ROSTER) {
    return render(
      <SceneEditor
        sceneId="s1"
        name="Konter"
        category="other"
        tags={[]}
        scene={SCENE}
        roster={roster}
      />,
    );
  }

  function pitch() {
    return screen.getByRole("group", { name: board.pitch });
  }

  it("starts off and shows only the position codes", () => {
    renderEditor();
    expect(
      screen.getByRole("switch", { name: board.showNames }),
    ).toHaveAttribute("aria-checked", "false");
    expect(within(pitch()).queryByText("Mila B.")).toBeNull();
    expect(within(pitch()).getByText("LV")).toBeInTheDocument();
    expect(within(pitch()).getByText("TW")).toBeInTheDocument();
  });

  it("shows the short names under linked tokens and remembers the choice", () => {
    const { container } = renderEditor();
    fireEvent.click(screen.getByRole("switch", { name: board.showNames }));
    const tag = pitch().querySelector('[data-tag-for="p1"]');
    expect(tag?.textContent).toBe("LV Mila B.");
    expect(window.localStorage.getItem(BOARD_NAMES_STORAGE_KEY)).toBe("shown");
    // The scene the editor saves carries no name, whatever the board shows.
    const saved = container.querySelector<HTMLInputElement>(
      'input[name="scene"]',
    )?.value;
    expect(saved).toContain(MILA_B);
    expect(saved).not.toContain("Mila");

    fireEvent.click(screen.getByRole("switch", { name: board.showNames }));
    expect(within(pitch()).queryByText("Mila B.", { exact: false })).toBeNull();
    expect(window.localStorage.getItem(BOARD_NAMES_STORAGE_KEY)).toBeNull();
  });

  it("offers no switch without a roster to name anyone from", () => {
    renderEditor([]);
    expect(screen.queryByRole("switch", { name: board.showNames })).toBeNull();
  });

  it("sets a player's position code from the selection panel", () => {
    renderEditor();
    fireEvent.focus(screen.getByRole("button", { name: "Heim 1" }));
    fireEvent.change(screen.getByLabelText(tacticsContent.panel.position), {
      target: { value: "iv" },
    });
    const tag = pitch().querySelector('[data-tag-for="p2"]');
    expect(tag?.textContent).toBe("IV");
  });
});

describe("names in a picture", () => {
  function renderPicture(names?: ReadonlyMap<string, string>) {
    return render(
      <BoardImage
        view="full"
        frame={keyframe(SCENE, 0)}
        preset="wide"
        legend={[]}
        title="Konter"
        names={names}
      />,
    );
  }

  it("shows the names the coach's board passes", () => {
    const { container } = renderPicture(tokenNames(SCENE.tokens, ROSTER));
    expect(container.textContent).toContain("Mila B.");
  });

  it("shows only the position codes without them", () => {
    const { container } = renderPicture();
    expect(container.textContent).not.toContain("Mila");
    expect(container.textContent).toContain("LV");
  });
});

describe("what leaves the coach's board", () => {
  // Every way a scene reaches a page or a person without a coach session.
  const payloads: [string, () => unknown][] = [
    ["a share link's scene", () => withoutRosterLinks(SCENE)],
    [
      "a collection link's scene entry",
      () =>
        toSceneItem({
          id: "entry-1",
          sceneId: "scene-1",
          name: "Konter",
          holdS: 8,
          position: 0,
          after: null,
          scene: SCENE,
        }),
    ],
    [
      "the audience window's entries",
      () =>
        audienceEntries([
          {
            kind: "scene",
            id: "entry-1",
            title: "Konter",
            subtitle: "",
            scene: SCENE,
            holdS: 8,
          },
        ]),
    ],
    [
      "the audience window's board",
      () =>
        audienceBoard({ scene: SCENE, step: 0, playback: null, draft: null }),
    ],
    ["a formation saved from the scene", () => formationFromScene(SCENE)],
    [
      "the board's clipboard",
      () =>
        clipOf({
          ...initialBoardState(SCENE),
          selectedIds: ["p1", "p2"],
        }),
    ],
  ];

  it.each(payloads)("%s carries no roster link and no name", (_name, make) => {
    const json = JSON.stringify(make());
    expect(json).not.toContain(MILA_B);
    expect(json).not.toContain("Mila");
    expect(json).not.toContain("Beispiel");
    // A position code is a role, not a person: it travels.
    expect(json).toContain('"position":"LV"');
  });
});
