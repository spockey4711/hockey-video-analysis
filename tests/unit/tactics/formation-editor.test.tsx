import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateSceneForm } from "@/features/tactics/CreateSceneForm";
import { FormationEditor } from "@/features/tactics/FormationEditor";
import { SceneEditor } from "@/features/tactics/SceneEditor";
import { tacticsContent } from "@/features/tactics/content";
import {
  builtInScene,
  formationFromScene,
  parseFormationJson,
} from "@/features/tactics/formation";
import type { FormationListItem } from "@/features/tactics/formation-queries";
import { defaultScene } from "@/features/tactics/scene";

// The forms post to server actions; nothing here submits them.
vi.mock("@/features/tactics/actions", () => ({
  createSceneAction: vi.fn(),
  saveSceneAction: vi.fn(),
  duplicateSceneAction: vi.fn(),
  deleteSceneAction: vi.fn(),
}));
vi.mock("@/features/tactics/formation-actions", () => ({
  saveFormationAction: vi.fn(),
  saveSceneAsFormationAction: vi.fn(),
  duplicateFormationAction: vi.fn(),
  deleteFormationAction: vi.fn(),
}));

const { board, create, editor, formations } = tacticsContent;

beforeEach(() => {
  // jsdom has no media queries; the board lies in landscape.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(cleanup);

function hidden(container: HTMLElement, name: string): string {
  const input = container.querySelector<HTMLInputElement>(
    `input[type="hidden"][name="${name}"]`,
  );
  if (!input) throw new Error(`no hidden ${name}`);
  return input.value;
}

describe("FormationEditor", () => {
  const formation = formationFromScene(builtInScene("corner-defence"));

  function renderEditor() {
    return render(
      <FormationEditor
        formationId="11111111-1111-4111-8111-111111111111"
        name="Tiefe Abwehr"
        kind="defence"
        formation={formation}
      />,
    );
  }

  it("offers only the placing tools, no lines", () => {
    renderEditor();
    const toolbar = screen.getByRole("toolbar", { name: board.toolbar });

    expect(
      within(toolbar).queryByRole("button", { name: board.modes.line }),
    ).toBeNull();
    expect(
      within(toolbar).queryByRole("button", { name: board.clearLines }),
    ).toBeNull();
    expect(
      within(toolbar).getByRole("button", { name: board.addHome }),
    ).toBeTruthy();
    expect(within(toolbar).getByText(board.views.corner)).toBeTruthy();
  });

  it("sends the arranged formation and marks the edit unsaved", () => {
    const { container } = renderEditor();
    expect(parseFormationJson(hidden(container, "formation"))).toEqual(
      formation,
    );
    expect(screen.queryByText(editor.unsaved)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: board.addAway }));

    const sent = parseFormationJson(hidden(container, "formation"));
    expect(sent?.tokens).toHaveLength(formation.tokens.length + 1);
    expect(sent?.view).toBe("corner");
    expect(screen.getByText(editor.unsaved)).toBeTruthy();
  });

  it("marks a changed kind unsaved and sends it", () => {
    const { container } = renderEditor();
    fireEvent.click(
      screen.getByRole("radio", { name: formations.kinds.attack }),
    );
    expect(hidden(container, "kind")).toBe("attack");
    expect(screen.getByText(editor.unsaved)).toBeTruthy();
  });
});

describe("CreateSceneForm", () => {
  const saved: FormationListItem[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Tiefe Abwehr",
      kind: "defence",
      view: "full",
      players: { home: 11, away: 0 },
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Fünf im Tor",
      kind: "defence",
      view: "corner",
      players: { home: 5, away: 6 },
    },
  ];

  function options(): string[] {
    const select = screen.getByLabelText(create.start);
    return [...select.querySelectorAll("option")].map(
      (option) => option.textContent ?? "",
    );
  }

  it("offers the built-in starts and the formations of the chosen view", () => {
    render(<CreateSceneForm formations={saved} />);
    expect(options()).toEqual([
      create.starts.lineup,
      create.starts.empty,
      create.formation("Tiefe Abwehr", formations.kinds.defence),
    ]);

    fireEvent.click(screen.getByRole("radio", { name: board.views.corner }));

    expect(options()).toEqual([
      create.starts.ball,
      create.starts["corner-defence"],
      create.starts["corner-attack"],
      create.formation("Fünf im Tor", formations.kinds.defence),
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>(create.start).value).toBe(
      "ball",
    );
  });

  it("says the scene starts from a copy once a formation is picked", () => {
    render(<CreateSceneForm formations={saved} />);
    expect(screen.queryByText(create.startHint)).toBeNull();
    fireEvent.change(screen.getByLabelText(create.start), {
      target: { value: saved[0]?.id },
    });
    expect(screen.getByText(create.startHint)).toBeTruthy();
  });
});

describe("SaveAsFormation in the scene editor", () => {
  it("opens a name and kind form that sends the board's scene", () => {
    const { container } = render(
      <SceneEditor
        sceneId="33333333-3333-4333-8333-333333333333"
        name="Pressing"
        scene={defaultScene()}
        roster={[]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: formations.fromScene.open }),
    );

    expect(screen.getByLabelText(formations.label)).toBeTruthy();
    expect(JSON.parse(hidden(container, "scene"))).toEqual(defaultScene());
    expect(hidden(container, "kind")).toBe("defence");
  });
});
