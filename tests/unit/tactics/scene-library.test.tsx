import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SceneFilterForm } from "@/features/tactics/SceneFilterForm";
import { ScenesList } from "@/features/tactics/ScenesList";
import { tacticsContent } from "@/features/tactics/content";
import { EMPTY_SCENE_FILTER } from "@/features/tactics/library";
import type { SceneListItem } from "@/features/tactics/queries";

afterEach(cleanup);

const { list, categories } = tacticsContent;
const { filter: copy } = list;

const SCENE: SceneListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ecke kurz Variante 2",
  category: "attack_corner",
  tags: ["Schlenzer", "hoch"],
  view: "corner",
  updatedAt: new Date("2026-09-01T10:00:00Z"),
};

describe("ScenesList", () => {
  it("shows each scene's category, view and tags on its link", () => {
    render(<ScenesList scenes={[SCENE]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/tactics/${SCENE.id}`);
    for (const text of ["Ecke Angriff", "Kurze Ecke", "Schlenzer", "hoch"]) {
      expect(within(link).getByText(text)).toBeInTheDocument();
    }
  });

  it("tells an empty library from a filter nothing passes", () => {
    render(<ScenesList scenes={[]} />);
    expect(screen.getByText(list.empty.title)).toBeInTheDocument();
    cleanup();
    render(<ScenesList scenes={[]} filtered />);
    expect(screen.getByText(list.noMatch.title)).toBeInTheDocument();
  });
});

describe("SceneFilterForm", () => {
  it("is a GET search form on /tactics prefilled with the filter", () => {
    render(
      <SceneFilterForm
        filter={{ query: "Ecke", category: "press", view: "full", tag: "hoch" }}
        tags={["hoch", "Schlenzer"]}
        shown={1}
        total={4}
      />,
    );
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/tactics");
    expect(screen.getByLabelText(copy.search)).toHaveValue("Ecke");
    expect(screen.getByLabelText(copy.category)).toHaveValue("press");
    expect(screen.getByLabelText(copy.view)).toHaveValue("full");
    expect(screen.getByLabelText(copy.tag)).toHaveValue("hoch");
    expect(screen.getByRole("link", { name: copy.reset })).toHaveAttribute(
      "href",
      "/tactics",
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 von 4 Szenen");
  });

  it("offers every category and tag, and no reset without a filter", () => {
    render(
      <SceneFilterForm
        filter={EMPTY_SCENE_FILTER}
        tags={["hoch"]}
        shown={4}
        total={4}
      />,
    );
    const category = screen.getByLabelText(copy.category);
    expect(
      within(category)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([copy.any, ...Object.values(categories)]);
    expect(
      within(screen.getByLabelText(copy.tag))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([copy.any, "hoch"]);
    expect(screen.queryByRole("link", { name: copy.reset })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("4 Szenen");
  });

  it("keeps a tag from the URL selectable when no scene carries it", () => {
    render(
      <SceneFilterForm
        filter={{ ...EMPTY_SCENE_FILTER, tag: "alt" }}
        tags={[]}
        shown={0}
        total={2}
      />,
    );
    expect(screen.getByLabelText(copy.tag)).toHaveValue("alt");
    expect(screen.getByLabelText(copy.tag)).toBeEnabled();
  });
});
