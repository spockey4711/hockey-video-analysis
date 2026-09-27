"use client";

import { useEffect, useState } from "react";

import { PresenterNotesPanel } from "./PresenterNotesPanel";
import { presentationContent } from "./content";
import { formatElapsed, formatTimeOfDay } from "./presenter-clock";
import type { PresenterNotesView } from "./presenter-notes";

import { Icon } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import type { PlaylistEntry } from "@/features/share/playlist/types";

export interface PresenterConsoleProps {
  readonly items: readonly PlaylistEntry[];
  /** The entry on screen. */
  readonly index: number;
  /** The notes for the entry on screen, when there are notes and they show. */
  readonly notes: PresenterNotesView | null;
  /** When the presentation started, in milliseconds since the epoch. */
  readonly startedAt: number;
  /** Jump to an entry of the list. */
  readonly onJump: (index: number) => void;
}

/**
 * The presenter's column beside the clip while the presentation runs on a
 * second screen (ADR 0015): the clock, what comes next, the coach's notes and
 * the whole list to jump around in. It only ever renders in the presenter's
 * own window; the audience window never receives any of it.
 */
export function PresenterConsole({
  items,
  index,
  notes,
  startedAt,
  onJump,
}: PresenterConsoleProps) {
  const copy = presentationContent.console;
  const next = items[index + 1];

  return (
    <aside
      aria-label={copy.label}
      className="type-presentation flex w-[min(calc(16.5*var(--presentation-unit)),40%)] shrink-0 flex-col gap-[var(--space-2)] overflow-hidden"
    >
      <PresenterClock startedAt={startedAt} />
      <section aria-label={copy.next} className={PANEL}>
        <p className={EYEBROW}>{copy.next}</p>
        {next ? (
          <p className="flex min-w-0 flex-col">
            <span className="truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)]">
              {next.title}
            </span>
            {next.subtitle && (
              <span className="truncate text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {next.subtitle}
              </span>
            )}
          </p>
        ) : (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {copy.end}
          </p>
        )}
      </section>
      {notes ? (
        <PresenterNotesPanel
          notes={notes}
          className="max-h-[40%] w-full shrink-0"
        />
      ) : null}
      <nav
        aria-label={copy.list}
        className={cn(PANEL, "min-h-0 flex-1 overflow-y-auto")}
      >
        <p className={EYEBROW}>{copy.list}</p>
        <ol className="flex flex-col gap-[var(--space-1)]">
          {items.map((item, itemIndex) => {
            const active = itemIndex === index;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onJump(itemIndex)}
                  className={cn(
                    "flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left transition duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
                    active
                      ? "bg-[var(--surface-hover)] text-[color:var(--text-primary)]"
                      : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "w-[2ch] shrink-0 text-right text-[length:var(--fs-caption)] tabular-nums",
                      active
                        ? "text-[color:var(--accent)]"
                        : "text-[color:var(--text-muted)]",
                    )}
                  >
                    {itemIndex + 1}
                  </span>
                  <Icon
                    name={item.kind === "scene" ? "columns-2" : "play"}
                    size={14}
                    className={
                      active
                        ? "shrink-0 text-[color:var(--accent)]"
                        : "shrink-0 text-[color:var(--text-muted)]"
                    }
                  />
                  <span className="truncate text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)]">
                    {item.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}

const PANEL =
  "flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-3)]";

const EYEBROW =
  "text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-muted)] uppercase";

/** The time of day and the time since the start, ticking once a second. */
function PresenterClock({ startedAt }: { startedAt: number }) {
  const copy = presentationContent.console;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={cn(PANEL, "flex-row items-end justify-between")}>
      <p className="flex flex-col">
        <span className={EYEBROW}>{copy.clock}</span>
        <span className="text-[length:var(--fs-h3)] [font-weight:var(--fw-semibold)] tabular-nums">
          {formatTimeOfDay(new Date(now))}
        </span>
      </p>
      <p className="flex flex-col items-end">
        <span className={EYEBROW}>{copy.elapsed}</span>
        <span className="text-[length:var(--fs-h3)] text-[color:var(--text-secondary)] tabular-nums">
          {formatElapsed(now - startedAt)}
        </span>
      </p>
    </div>
  );
}
