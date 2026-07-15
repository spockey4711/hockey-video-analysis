"use client";

/**
 * Instant jump-marker navigation (P1-1). The watch page (P0-5) mounts this into
 * the player's `sidebar` slot, where it runs inside the player's context and
 * reads the live controller. It lets a coach jump between tagged moments - via
 * prev/next controls, the `,` / `.` hotkeys, or by clicking a marker in the
 * list - the instant a game is loaded, without waiting for the clip-cutting
 * pipeline (PRD Phase 1 s11 Option A).
 *
 * Jumps read frame-current time from the controller (`getGameTimeS`) so repeated
 * presses always step to the next tag; the active-marker highlight tracks the
 * throttled `gameTimeS` render value, which is precise enough for the list.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { usePlayerController } from "../PlayerContext";

import { jumpMarkersContent } from "./content";
import {
  activeMarker,
  nextMarker,
  previousMarker,
  sortMarkers,
  type JumpMarker,
} from "./navigation";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { formatGameTime, TagChip, Timecode } from "@/components/data";
import { IconButton } from "@/components/forms/IconButton";
import { getTagType, isTagTypeKey, type TagTypeKey } from "@/lib/tag-types";

export interface JumpMarkerNavProps {
  /** The game's tags as markers (empty when none captured yet). */
  readonly markers: readonly JumpMarker[];
}

/** German label for a marker's tag type, falling back to the raw key. */
function markerLabel(type: string): string {
  return getTagType(type)?.label ?? type;
}

/** Whether a keydown target is a text-entry surface we must not hijack. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function JumpMarkerNav({ markers }: JumpMarkerNavProps) {
  const { gameTimeS, getGameTimeS, seekTo } = usePlayerController();
  const [announcement, setAnnouncement] = useState("");

  const sorted = useMemo(() => sortMarkers(markers), [markers]);
  const current = activeMarker(sorted, gameTimeS);
  const hasPrevious = previousMarker(sorted, gameTimeS) !== null;
  const hasNext = nextMarker(sorted, gameTimeS) !== null;

  // Jump to a marker: seek the player and announce it for keyboard-first coaches.
  function jumpTo(marker: JumpMarker): void {
    seekTo(marker.startS);
    setAnnouncement(
      jumpMarkersContent.jumpedTo(
        markerLabel(marker.type),
        formatGameTime(marker.startS).main,
      ),
    );
  }

  // Keep the latest jump inputs in a ref so the window listener binds once and
  // still reads fresh values, avoiding a stale closure without re-subscribing.
  const latest = useRef({ sorted, getGameTimeS, jumpTo });
  useEffect(() => {
    latest.current = { sorted, getGameTimeS, jumpTo };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== "," && event.key !== ".") return;
      if (isEditableTarget(event.target)) return;

      const {
        sorted: current,
        getGameTimeS: read,
        jumpTo: jump,
      } = latest.current;
      const now = read();
      const target =
        event.key === "."
          ? nextMarker(current, now)
          : previousMarker(current, now);
      if (!target) return;
      event.preventDefault();
      jump(target);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function jumpRelative(direction: "previous" | "next"): void {
    const now = getGameTimeS();
    const target =
      direction === "next"
        ? nextMarker(sorted, now)
        : previousMarker(sorted, now);
    if (target) jumpTo(target);
  }

  return (
    <Card
      as="section"
      panel
      aria-label={jumpMarkersContent.panelTitle}
      className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={jumpMarkersContent.panelTitle}
        hint={jumpMarkersContent.panelHint}
        action={
          sorted.length > 0 ? (
            <>
              <IconButton
                name="chevron-left"
                label={jumpMarkersContent.previous}
                disabled={!hasPrevious}
                onClick={() => jumpRelative("previous")}
              />
              <IconButton
                name="chevron-right"
                label={jumpMarkersContent.next}
                disabled={!hasNext}
                onClick={() => jumpRelative("next")}
              />
            </>
          ) : null
        }
      />

      {sorted.length === 0 ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {jumpMarkersContent.empty}
        </p>
      ) : (
        <>
          <ul className="flex max-h-[16rem] flex-col gap-[var(--space-1)] overflow-y-auto">
            {sorted.map((marker) => {
              const label = markerLabel(marker.type);
              const isActive = current?.id === marker.id;
              return (
                <li key={marker.id}>
                  <button
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => jumpTo(marker)}
                    className={`flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none ${
                      isActive ? "bg-[var(--surface-hover)]" : ""
                    }`}
                    title={jumpMarkersContent.jumpTo(
                      label,
                      formatGameTime(marker.startS).main,
                    )}
                  >
                    {isTagTypeKey(marker.type) ? (
                      // Guarded above, so the free-text key is a valid tag type.
                      <TagChip type={marker.type as TagTypeKey} size="sm" />
                    ) : (
                      <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]">
                        {label}
                      </span>
                    )}
                    <Timecode
                      seconds={marker.startS}
                      size="sm"
                      muted={!isActive}
                      className="ml-auto"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[length:var(--fs-micro)] text-[color:var(--text-muted)]">
            {jumpMarkersContent.hotkeyHint}
          </p>
        </>
      )}

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>
    </Card>
  );
}
