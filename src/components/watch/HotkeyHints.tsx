import { Fragment } from "react";

import { watchContent } from "./content";

import { Card } from "@/components/core/Card";
import { Kbd } from "@/components/data/Kbd";

/** One hotkey affordance: the key(s) to press and what they do. */
export interface HotkeyHint {
  /** Keys shown as caps; multiple render as a `key / key` alternation. */
  readonly keys: readonly string[];
  /** What pressing the key does, in the coach's language. */
  readonly label: string;
}

/** A titled cluster of related hotkeys (e.g. tagging, timeline navigation). */
export interface HotkeyGroup {
  readonly title: string;
  readonly hints: readonly HotkeyHint[];
}

export interface HotkeyHintsProps {
  /** Groups rendered top to bottom; each lists its hints as `Kbd` + label. */
  readonly groups: readonly HotkeyGroup[];
}

/**
 * Keyboard-hint reference for the watch page (UX-6): a compact, token-driven
 * panel that documents the tagging and timeline hotkeys with `Kbd` key caps so
 * a keyboard-first coach can learn the shortcuts without leaving the player.
 * Purely presentational - the caller supplies the groups (built from the
 * tag-type config and the player's navigation keys), so this component owns no
 * hotkey logic.
 */
export function HotkeyHints({ groups }: HotkeyHintsProps) {
  const { hotkeys } = watchContent;

  return (
    <Card
      as="section"
      panel
      aria-label={hotkeys.title}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]"
    >
      <div className="flex flex-col gap-[var(--space-1)]">
        <h2 className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-secondary)] uppercase">
          {hotkeys.title}
        </h2>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {hotkeys.hint}
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-[var(--space-2)]">
          <h3 className="text-[length:var(--fs-micro)] [font-weight:var(--fw-medium)] tracking-[var(--ls-caps)] text-[color:var(--text-muted)] uppercase">
            {group.title}
          </h3>
          <ul className="flex flex-col gap-[var(--space-2)]">
            {group.hints.map((hint) => (
              <li
                key={hint.label}
                className="flex items-center gap-[var(--space-3)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]"
              >
                <span className="flex shrink-0 items-center gap-[var(--space-1)]">
                  {hint.keys.map((key, index) => (
                    <Fragment key={key}>
                      {index > 0 ? (
                        <span
                          aria-hidden
                          className="text-[length:var(--fs-micro)] text-[color:var(--text-muted)]"
                        >
                          /
                        </span>
                      ) : null}
                      <Kbd>{key}</Kbd>
                    </Fragment>
                  ))}
                </span>
                <span>{hint.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
