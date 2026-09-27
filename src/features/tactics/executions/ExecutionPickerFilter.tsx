import { executionsContent } from "./content";
import { ANY_TYPE, momentGameLabel, type PickerFilter } from "./items";
import type { ExecutionGame } from "./queries";

import { Card } from "@/components/core/Card";
import { Button, Select } from "@/components/forms";
import { TAG_TYPES } from "@/lib/tag-types";

const { picker: copy } = executionsContent;

/**
 * The picker's filter: a tag type (short corners unless the coach picks
 * another, or all of them) and a game, as a plain GET form that reloads the
 * picker with the filter in the URL, like the scene list's filter.
 */
export function ExecutionPickerFilter({
  sceneId,
  filter,
  games,
}: {
  readonly sceneId: string;
  readonly filter: PickerFilter;
  /** The games with tags, newest first. */
  readonly games: readonly ExecutionGame[];
}) {
  return (
    <Card
      as="section"
      aria-label={copy.filterHeading}
      className="p-[var(--space-4)]"
    >
      <form
        method="get"
        action={`/tactics/${sceneId}/executions/link`}
        role="search"
        className="grid grid-cols-1 items-end gap-[var(--space-3)] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
      >
        <Select
          name="type"
          label={copy.type}
          options={[
            { value: ANY_TYPE, label: copy.anyType },
            ...TAG_TYPES.map((type) => ({
              value: type.key,
              label: type.label,
            })),
          ]}
          defaultValue={filter.type ?? ANY_TYPE}
        />
        <Select
          name="game"
          label={copy.game}
          options={[
            { value: "", label: copy.anyGame },
            ...games.map((game) => ({
              value: game.id,
              label: momentGameLabel(game),
            })),
          ]}
          defaultValue={filter.gameId ?? ""}
        />
        <Button type="submit" variant="secondary">
          {copy.apply}
        </Button>
      </form>
    </Card>
  );
}
