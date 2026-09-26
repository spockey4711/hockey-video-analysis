import Link from "next/link";

import { tacticsContent } from "./content";
import {
  isSceneFilterSet,
  MAX_SCENE_QUERY_LENGTH,
  SCENE_CATEGORIES,
  type SceneFilter,
} from "./library";
import { PITCH_VIEWS } from "./pitch";

import { Card } from "@/components/core/Card";
import { Button, buttonClassName, Input, Select } from "@/components/forms";

const { list, categories, board } = tacticsContent;
const { filter: copy } = list;

/**
 * The scene list's filter: a search over names and tags plus category, view
 * and tag choices, as a plain GET form that reloads `/tactics` with the
 * filter in the URL, so it works without client JS and can be bookmarked or
 * shared among coaches. The reset link only shows while a filter is set.
 */
export function SceneFilterForm({
  filter,
  tags,
  shown,
  total,
}: {
  readonly filter: SceneFilter;
  /** Every tag in use, for the tag choice. */
  readonly tags: readonly string[];
  /** How many scenes pass the filter, and how many there are. */
  readonly shown: number;
  readonly total: number;
}) {
  const any = { value: "", label: copy.any };
  // A tag from the URL that no scene carries any more stays selectable, so
  // the form shows what the list is filtered by.
  const tagOptions =
    filter.tag && !tags.includes(filter.tag) ? [...tags, filter.tag] : tags;

  return (
    <Card as="section" aria-label={copy.heading} className="p-[var(--space-4)]">
      <form
        method="get"
        action="/tactics"
        role="search"
        className="grid grid-cols-2 items-end gap-[var(--space-3)] lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]"
      >
        <div className="col-span-2 lg:col-span-1">
          <Input
            type="search"
            name="q"
            label={copy.search}
            placeholder={copy.searchPlaceholder}
            leading="search"
            maxLength={MAX_SCENE_QUERY_LENGTH}
            defaultValue={filter.query}
            autoComplete="off"
          />
        </div>
        <Select
          name="category"
          label={copy.category}
          options={[
            any,
            ...SCENE_CATEGORIES.map((value) => ({
              value,
              label: categories[value],
            })),
          ]}
          defaultValue={filter.category ?? ""}
        />
        <Select
          name="view"
          label={copy.view}
          options={[
            any,
            ...PITCH_VIEWS.map((value) => ({
              value,
              label: board.views[value],
            })),
          ]}
          defaultValue={filter.view ?? ""}
        />
        <div className="col-span-2 lg:col-span-1">
          <Select
            name="tag"
            label={copy.tag}
            options={[any, ...tagOptions]}
            defaultValue={filter.tag ?? ""}
            disabled={tagOptions.length === 0}
          />
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-[var(--space-2)] sm:gap-[var(--space-3)] lg:col-span-4">
          <Button type="submit" variant="secondary">
            {copy.apply}
          </Button>
          {isSceneFilterSet(filter) ? (
            <Link
              href="/tactics"
              className={buttonClassName({ variant: "ghost" })}
            >
              {copy.reset}
            </Link>
          ) : null}
          <p
            role="status"
            className="ml-auto text-[length:var(--fs-body-sm)] whitespace-nowrap text-[color:var(--text-muted)]"
          >
            {copy.count(shown, total)}
          </p>
        </div>
      </form>
    </Card>
  );
}
