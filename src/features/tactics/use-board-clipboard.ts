"use client";

/**
 * The board's copy and paste for an editor: whether there is a selection to
 * copy and a clip that fits this board, the two commands, and the shortcuts
 * that run them. The clip itself lives in storage (see `clipboard.ts`), so a
 * paste works in any scene of the same view, here or in another tab.
 */
import { useMemo, useSyncExternalStore, type Dispatch } from "react";

import { clipboardKey, type BoardKeyEvent } from "./board-keys";
import type { BoardAction, BoardState } from "./board-state";
import {
  clipOf,
  readClip,
  storedClipText,
  subscribeToClip,
  writeClip,
  type BoardClip,
} from "./clipboard";

export interface BoardClipboard {
  readonly canCopy: boolean;
  readonly canPaste: boolean;
  readonly copy: () => void;
  readonly paste: () => void;
  /**
   * Run the clipboard shortcut a key press stands for. Returns whether it
   * did, so the caller stops the browser's own copy or paste.
   */
  readonly onKeyDown: (event: BoardKeyEvent) => boolean;
}

/** The server has no clipboard; the board reads it once it is in the browser. */
function noClip(): null {
  return null;
}

export function useBoardClipboard(
  state: BoardState,
  dispatch: Dispatch<BoardAction>,
  /** A board of start positions only, as for a formation: lines do not paste. */
  positionsOnly = false,
): BoardClipboard {
  const text = useSyncExternalStore(subscribeToClip, storedClipText, noClip);
  const view = state.scene.view;
  const clip = useMemo((): BoardClip | null => {
    const stored = readClip(text);
    if (!stored || stored.view !== view) return null;
    if (!positionsOnly) return stored;
    return stored.tokens.length > 0 ? { ...stored, lines: [] } : null;
  }, [text, view, positionsOnly]);
  const canCopy = state.selectedIds.length > 0;

  function copy(): void {
    const copied = clipOf(state);
    if (copied) writeClip(copied);
  }

  function paste(): void {
    if (clip) dispatch({ type: "paste", clip });
  }

  function onKeyDown(event: BoardKeyEvent): boolean {
    const command = clipboardKey(event);
    if (command === "copy" && canCopy) copy();
    else if (command === "paste" && clip) paste();
    else return false;
    return true;
  }

  return { canCopy, canPaste: clip !== null, copy, paste, onKeyDown };
}
