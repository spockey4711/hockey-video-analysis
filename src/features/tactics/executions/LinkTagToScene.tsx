"use client";

import { useEffect, useState } from "react";

import { executionsContent } from "./content";
import type { TagSceneChoice } from "./queries";

import { Icon } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";

const { watch: copy, outcomes } = executionsContent;

export interface LinkTagToSceneProps {
  /** The tag to link as an execution. */
  readonly tagId: string;
  /** Called when the coach is done. */
  readonly onDone: () => void;
}

/** Read the tag's scenes from `url` with `method`, or `null` when that failed. */
async function requestScenes(
  url: string,
  method: "GET" | "PUT" | "DELETE" = "GET",
): Promise<TagSceneChoice[] | null> {
  try {
    const response = await fetch(url, { method });
    if (!response.ok) return null;
    const { scenes } = (await response.json()) as { scenes: TagSceneChoice[] };
    return scenes;
  } catch {
    return null;
  }
}

/**
 * The watch page's "Mit Szene verknüpfen" (plan vs reality): every tactics
 * scene by name, each a toggle that links the selected tag to it as an
 * execution or unlinks it again. A linked scene shows how the execution
 * went; the coach rates it on the scene's page.
 */
export function LinkTagToScene({ tagId, onDone }: LinkTagToSceneProps) {
  const [scenes, setScenes] = useState<TagSceneChoice[] | "loading" | "failed">(
    "loading",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void requestScenes(`/api/tags/${tagId}/scenes`).then((list) => {
      if (live) setScenes(list ?? "failed");
    });
    return () => {
      live = false;
    };
  }, [tagId]);

  async function toggle(scene: TagSceneChoice) {
    setBusyId(scene.id);
    setFailed(false);
    const next = await requestScenes(
      `/api/tags/${tagId}/scenes/${scene.id}`,
      scene.outcome === null ? "PUT" : "DELETE",
    );
    setBusyId(null);
    if (next) setScenes(next);
    else setFailed(true);
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)] text-[length:var(--fs-body-sm)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        {/* eslint-disable-next-line no-restricted-syntax -- a body-size run-in title inside the tag detail, below every Heading rung. */}
        <h3 className="[font-weight:var(--fw-semibold)]">{copy.heading}</h3>
        <p className="text-[color:var(--text-muted)]">{copy.hint}</p>
      </div>

      {scenes === "loading" ? (
        <p role="status" className="text-[color:var(--text-muted)]">
          {copy.loading}
        </p>
      ) : scenes === "failed" ? (
        <p role="alert" className="text-[color:var(--danger)]">
          {copy.loadFailed}
        </p>
      ) : scenes.length === 0 ? (
        <p className="text-[color:var(--text-muted)]">{copy.none}</p>
      ) : (
        <ul className="flex max-h-[30vh] flex-col gap-[var(--space-1)] overflow-y-auto">
          {scenes.map((scene) => {
            const linked = scene.outcome !== null;
            return (
              <li key={scene.id}>
                <button
                  type="button"
                  aria-pressed={linked}
                  aria-label={
                    linked ? copy.unlink(scene.name) : copy.link(scene.name)
                  }
                  disabled={busyId !== null}
                  onClick={() => void toggle(scene)}
                  className={cn(
                    "flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-left transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                    linked
                      ? "border-[color:var(--accent)] bg-[var(--surface-raised)]"
                      : "border-[color:var(--border)]",
                  )}
                >
                  <Icon
                    name={linked ? "check" : "plus"}
                    size={14}
                    className={
                      linked
                        ? "shrink-0 text-[color:var(--accent)]"
                        : "shrink-0 text-[color:var(--text-muted)]"
                    }
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate [font-weight:var(--fw-medium)]">
                      {scene.name}
                    </span>
                    {scene.outcome !== null && (
                      <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                        {copy.linked(outcomes[scene.outcome])}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p role="status" className="text-[color:var(--danger)] empty:hidden">
        {failed ? copy.failed : ""}
      </p>

      <div>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {copy.done}
        </Button>
      </div>
    </div>
  );
}
