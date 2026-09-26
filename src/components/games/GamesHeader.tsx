import Link from "next/link";

import { Icon } from "@/components/core/Icon";
import { PageHeader } from "@/components/core/PageHeader";
import { BUTTON_ICON_SIZE, buttonClassName } from "@/components/forms";
import { gamesContent } from "@/features/games";

const { list } = gamesContent;

/**
 * Header for the games surface: the list title and subtitle with the "new game"
 * action. Shared by the games page and its loading fallback so the two frames do
 * not jump. Presentational only.
 */
export function GamesHeader() {
  return (
    <PageHeader
      title={list.title}
      subtitle={list.subtitle}
      actions={
        <Link
          href="/games/new"
          className={buttonClassName({ variant: "primary" })}
        >
          <Icon name="plus" size={BUTTON_ICON_SIZE.md} />
          {list.newGame}
        </Link>
      }
    />
  );
}
