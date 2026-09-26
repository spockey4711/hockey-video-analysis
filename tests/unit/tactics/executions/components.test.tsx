import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/tactics/executions/actions", () => ({
  executionAction: vi.fn(),
  linkExecutionsAction: vi.fn(),
}));

import { ScenesList } from "@/features/tactics/ScenesList";
import { ExecutionPicker } from "@/features/tactics/executions/ExecutionPicker";
import { LinkTagToScene } from "@/features/tactics/executions/LinkTagToScene";
import { SceneExecutions } from "@/features/tactics/executions/SceneExecutions";
import { executionsContent } from "@/features/tactics/executions/content";
import type { ExecutionRowView } from "@/features/tactics/executions/items";
import { executionStats } from "@/features/tactics/executions/outcome";
import type { SceneListItem } from "@/features/tactics/queries";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const { scene: copy, picker, watch } = executionsContent;
const SCENE_ID = "11111111-1111-4111-8111-111111111111";
const TAG_ID = "22222222-2222-4222-8222-222222222222";

const ROW: ExecutionRowView = {
  tagId: TAG_ID,
  gameId: "33333333-3333-4333-8333-333333333333",
  startS: 725,
  title: "Ecke kurz",
  subtitle: "Liga Spieltag 3 - gegen TV Musterstadt - 10.05.2026 - 12:05",
  outcome: "success",
  clipStatus: null,
};

describe("ScenesList", () => {
  const scene: SceneListItem = {
    id: SCENE_ID,
    name: "Ecke kurz Variante 2",
    category: "attack_corner",
    tags: [],
    view: "corner",
    updatedAt: new Date("2026-09-01T10:00:00Z"),
  };

  it("shows a scene's executions and success rate beside it", () => {
    render(
      <ScenesList
        scenes={[scene]}
        executions={
          new Map([
            [
              SCENE_ID,
              executionStats(["success", "failure", "open", "success"]),
            ],
          ])
        }
      />,
    );
    const link = screen.getByRole("link");
    expect(within(link).getByText("4 Ausführungen")).toBeInTheDocument();
    expect(within(link).getByText("67 % erfolgreich")).toBeInTheDocument();
  });

  it("shows nothing for a scene without executions", () => {
    render(<ScenesList scenes={[scene]} />);
    expect(screen.queryByText(/Ausführung/)).not.toBeInTheDocument();
  });
});

describe("SceneExecutions", () => {
  it("shows the count, the rate and each execution with its outcome", () => {
    render(
      <SceneExecutions
        sceneId={SCENE_ID}
        stats={executionStats(["success", "open"])}
        rows={[ROW]}
        playable={0}
      />,
    );
    const card = screen.getByRole("region", { name: copy.heading });
    expect(within(card).getByText("100 %")).toBeInTheDocument();
    expect(
      within(card).getByText(/1 erfolgreich, 0 nicht erfolgreich, 1 offen/),
    ).toBeInTheDocument();
    const outcome = within(card).getByRole("combobox", {
      name: copy.outcomeLabel(`${ROW.title}, ${ROW.subtitle}`),
    });
    expect(outcome).toHaveValue("success");
    expect(within(card).getByText(copy.noClip)).toBeInTheDocument();
    expect(
      within(card).getByRole("button", {
        name: copy.unlink(`${ROW.title}, ${ROW.subtitle}`),
      }),
    ).toBeInTheDocument();
  });

  it("offers watching only when a clip is ready, and linking always", () => {
    render(
      <SceneExecutions
        sceneId={SCENE_ID}
        stats={executionStats([])}
        rows={[]}
        playable={0}
      />,
    );
    expect(
      screen.queryByRole("link", { name: copy.watch }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.link })).toHaveAttribute(
      "href",
      `/tactics/${SCENE_ID}/executions/link`,
    );
    expect(screen.getByText(copy.empty.title)).toBeInTheDocument();
    cleanup();

    render(
      <SceneExecutions
        sceneId={SCENE_ID}
        stats={executionStats(["open"])}
        rows={[{ ...ROW, outcome: "open", clipStatus: "ready" }]}
        playable={1}
      />,
    );
    expect(screen.getByRole("link", { name: copy.watch })).toHaveAttribute(
      "href",
      `/tactics/${SCENE_ID}/executions`,
    );
  });
});

describe("ExecutionPicker", () => {
  it("keeps linked tags ticked and fixed and links only a new pick", () => {
    render(
      <ExecutionPicker
        sceneId={SCENE_ID}
        rows={[
          { ...ROW, linked: true, clipStatus: "ready" },
          {
            ...ROW,
            tagId: "44444444-4444-4444-8444-444444444444",
            linked: false,
            clipStatus: "ready",
          },
        ]}
      />,
    );
    const [linked, fresh] = screen.getAllByRole("checkbox");
    expect(linked).toBeChecked();
    expect(linked).toBeDisabled();
    const submit = screen.getByRole("button", { name: picker.submit });
    expect(submit).toBeDisabled();
    fireEvent.click(fresh as HTMLElement);
    expect(fresh).toBeChecked();
    expect(submit).toBeEnabled();
    expect(screen.getByText(picker.chosen(1))).toBeInTheDocument();
  });
});

describe("LinkTagToScene", () => {
  it("links the tag to a scene and shows the link's outcome", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          scenes: [{ id: SCENE_ID, name: "Ecke Variante 1", outcome: null }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          scenes: [{ id: SCENE_ID, name: "Ecke Variante 1", outcome: "open" }],
        }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<LinkTagToScene tagId={TAG_ID} onDone={() => {}} />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: watch.link("Ecke Variante 1"),
      }),
    );
    const linked = await screen.findByRole("button", {
      name: watch.unlink("Ecke Variante 1"),
    });
    expect(linked).toHaveAttribute("aria-pressed", "true");
    expect(within(linked).getByText(watch.linked("Offen"))).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/tags/${TAG_ID}/scenes/${SCENE_ID}`,
      { method: "PUT" },
    );
  });

  it("says so when the scenes cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
    render(<LinkTagToScene tagId={TAG_ID} onDone={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(watch.loadFailed),
    );
  });
});
