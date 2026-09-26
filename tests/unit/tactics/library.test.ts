import { describe, expect, it } from "vitest";

import {
  collectSceneTags,
  EMPTY_SCENE_FILTER,
  filterScenes,
  formatSceneTags,
  isSceneFilterSet,
  normalizeSceneTags,
  parseSceneCategory,
  parseSceneFilter,
  SCENE_CATEGORIES,
  sceneFilterQuery,
  type FilterableScene,
  type SceneFilter,
} from "@/features/tactics/library";
import { sceneCategoryEnum } from "@/lib/db/schema";

describe("scene categories", () => {
  it("are the database enum's values", () => {
    expect(SCENE_CATEGORIES).toEqual(sceneCategoryEnum.enumValues);
  });

  it("parse only a known category", () => {
    expect(parseSceneCategory("attack_corner")).toBe("attack_corner");
    expect(parseSceneCategory("Ecke Angriff")).toBeNull();
    expect(parseSceneCategory("")).toBeNull();
    expect(parseSceneCategory(null)).toBeNull();
  });
});

describe("normalizeSceneTags", () => {
  it("trims, drops empty tags and collapses inner whitespace", () => {
    expect(normalizeSceneTags("  Schlenzer ,, Variante   2 , ")).toEqual([
      "Schlenzer",
      "Variante 2",
    ]);
  });

  it("keeps the first spelling of a tag that repeats, ignoring case and accents", () => {
    expect(
      normalizeSceneTags("Überzahl, ueberzahl, uberzahl, ÜBERZAHL"),
    ).toEqual(["Überzahl", "ueberzahl"]);
  });

  it("reads a missing or empty field as no tags", () => {
    expect(normalizeSceneTags(null)).toEqual([]);
    expect(normalizeSceneTags(undefined)).toEqual([]);
    expect(normalizeSceneTags("")).toEqual([]);
    expect(normalizeSceneTags(" , ")).toEqual([]);
  });

  it("allows ten tags of thirty characters, and no more", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(normalizeSceneTags(ten.join(","))).toEqual(ten);
    expect(normalizeSceneTags([...ten, "t10"].join(","))).toBeNull();
    // Repeats do not count towards the limit.
    expect(normalizeSceneTags([...ten, "T0"].join(","))).toEqual(ten);
    expect(normalizeSceneTags("x".repeat(30))).toEqual(["x".repeat(30)]);
    expect(normalizeSceneTags("x".repeat(31))).toBeNull();
  });

  it("refuses a value that is not text", () => {
    expect(normalizeSceneTags(42)).toBeNull();
  });

  it("round-trips through the editor's text field", () => {
    const tags = ["hoch", "Falle links"];
    expect(normalizeSceneTags(formatSceneTags(tags))).toEqual(tags);
  });
});

describe("parseSceneFilter", () => {
  it("reads every criterion from the search params", () => {
    expect(
      parseSceneFilter({
        q: "  Ecke ",
        category: "press",
        view: "corner",
        tag: " hoch ",
      }),
    ).toEqual({
      query: "Ecke",
      category: "press",
      view: "corner",
      tag: "hoch",
    });
  });

  it("falls back to any for missing, empty or unknown values", () => {
    expect(parseSceneFilter({})).toEqual(EMPTY_SCENE_FILTER);
    expect(
      parseSceneFilter({ q: "", category: "", view: "", tag: "" }),
    ).toEqual(EMPTY_SCENE_FILTER);
    expect(
      parseSceneFilter({
        category: "Ecke",
        view: "corner-right",
        tag: "x".repeat(31),
      }),
    ).toEqual(EMPTY_SCENE_FILTER);
  });

  it("takes the first of a repeated param and caps the search", () => {
    expect(
      parseSceneFilter({ category: ["press", "other"], q: "a".repeat(200) }),
    ).toEqual({
      ...EMPTY_SCENE_FILTER,
      category: "press",
      query: "a".repeat(120),
    });
  });
});

describe("sceneFilterQuery", () => {
  it("is empty without a filter", () => {
    expect(sceneFilterQuery(EMPTY_SCENE_FILTER)).toBe("");
    expect(isSceneFilterSet(EMPTY_SCENE_FILTER)).toBe(false);
  });

  it("carries only the set criteria and parses back to the same filter", () => {
    const filter: SceneFilter = {
      query: "Ecke & Co",
      category: null,
      view: "full",
      tag: "hoch",
    };
    const query = sceneFilterQuery(filter);
    expect(query).toBe("?q=Ecke+%26+Co&view=full&tag=hoch");
    expect(
      parseSceneFilter(Object.fromEntries(new URLSearchParams(query))),
    ).toEqual(filter);
    expect(isSceneFilterSet(filter)).toBe(true);
  });
});

const SCENES: (FilterableScene & { id: string })[] = [
  {
    id: "a",
    name: "Ecke kurz Variante 2",
    category: "attack_corner",
    view: "corner",
    tags: ["Schlenzer"],
  },
  {
    id: "b",
    name: "Ecke verteidigen",
    category: "defence_corner",
    view: "corner",
    tags: ["Läufer links", "hoch"],
  },
  {
    id: "c",
    name: "Hohes Pressing",
    category: "press",
    view: "full",
    tags: ["hoch", "Überzahl"],
  },
  {
    id: "d",
    name: "Aufbau über rechts",
    category: "build_up",
    view: "full",
    tags: [],
  },
];

function ids(filter: Partial<SceneFilter>): string[] {
  return filterScenes(SCENES, { ...EMPTY_SCENE_FILTER, ...filter }).map(
    (scene) => scene.id,
  );
}

describe("filterScenes", () => {
  it("keeps every scene, in order, without a filter", () => {
    expect(ids({})).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by category, view and tag", () => {
    expect(ids({ category: "press" })).toEqual(["c"]);
    expect(ids({ view: "corner" })).toEqual(["a", "b"]);
    expect(ids({ tag: "hoch" })).toEqual(["b", "c"]);
    expect(ids({ tag: "HOCH" })).toEqual(["b", "c"]);
    expect(ids({ tag: "ho" })).toEqual([]);
  });

  it("needs every set criterion to hold", () => {
    expect(ids({ tag: "hoch", view: "full" })).toEqual(["c"]);
    expect(ids({ category: "press", view: "corner" })).toEqual([]);
  });

  it("searches parts of names and tags, ignoring case and accents", () => {
    expect(ids({ query: "ecke" })).toEqual(["a", "b"]);
    expect(ids({ query: "schlenz" })).toEqual(["a"]);
    expect(ids({ query: "uberzahl" })).toEqual(["c"]);
    expect(ids({ query: "UBER" })).toEqual(["c", "d"]);
    expect(ids({ query: "Pressing Pass" })).toEqual([]);
  });

  it("needs every search word to match somewhere", () => {
    expect(ids({ query: "ecke  links" })).toEqual(["b"]);
    expect(ids({ query: "pressing hoch" })).toEqual(["c"]);
  });
});

describe("collectSceneTags", () => {
  it("lists every tag once, alphabetically", () => {
    expect(collectSceneTags(SCENES)).toEqual([
      "hoch",
      "Läufer links",
      "Schlenzer",
      "Überzahl",
    ]);
  });

  it("keeps the first spelling of a tag used in different cases", () => {
    expect(
      collectSceneTags([{ tags: ["Hoch"] }, { tags: ["hoch", "tief"] }]),
    ).toEqual(["Hoch", "tief"]);
  });
});
