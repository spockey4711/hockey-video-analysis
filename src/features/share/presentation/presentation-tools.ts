/**
 * The presenter's on-screen tools in presentation mode: the drawing layer on a
 * paused clip (P2-10) and the laser pointer. At most one is on at a time -
 * switching one on switches the other off - so a pointer never wanders over a
 * drawing and a pen stroke never starts while the presenter is pointing.
 */
export type PresentationTool = "draw" | "pointer";

/** The tool that is on, if any. */
export type ActiveTool = PresentationTool | null;

/**
 * The tool left on after the presenter toggles `tool` while `active` is on:
 * toggling the tool that is on turns it off, toggling any other one swaps to it.
 */
export function toggleTool(
  active: ActiveTool,
  tool: PresentationTool,
): ActiveTool {
  return active === tool ? null : tool;
}

/** The single-letter shortcut that switches the laser pointer on and off. */
export const POINTER_KEY = "p";

/**
 * Whether a key press is the laser pointer shortcut: a plain `p` (either case),
 * never with a modifier, so browser and OS shortcuts such as Ctrl+P keep working.
 * `p` is free next to the drawing keys (`d`, `w`, Ctrl/Cmd+Z) and the transport
 * keys (arrows, space, `j`, `l`, `b`, `n`, `f`).
 */
export function isPointerShortcut(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
}): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
    return false;
  }
  return event.key.toLowerCase() === POINTER_KEY;
}
