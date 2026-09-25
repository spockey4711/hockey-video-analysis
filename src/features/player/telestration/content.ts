/**
 * User-facing copy for telestration (P2-10), German like the rest of the
 * coach-facing player.
 */
import type { StillExportError } from "./export";
import type { DrawTool, PenColor, StrokeWidth } from "./state";

export const telestrationContent = {
  /** The transport switch and the `d` hotkey that open the drawing layer. */
  toggle: "Zeichnen (D)",
  /** Accessible name of the drawing surface over the frame. */
  canvas: "Zeichenfläche über dem Standbild",
  toolbar: "Zeichenwerkzeuge",
  tools: {
    freehand: "Freihand",
    arrow: "Pfeil",
    curve: "Kurvenpfeil (K)",
    circle: "Kreis",
  } satisfies Record<DrawTool, string>,
  colors: {
    red: "Rot",
    yellow: "Gelb",
    blue: "Blau",
    white: "Weiß",
  } satisfies Record<PenColor, string>,
  color: (name: string) => `Farbe: ${name}`,
  widths: {
    thin: "Dünn",
    medium: "Mittel",
    thick: "Dick",
  } satisfies Record<StrokeWidth, string>,
  width: (name: string) => `Strichstärke: ${name} (W)`,
  /** The line-style toggle, pressed while new strokes come out dotted. */
  dotted: "Gepunktet (O)",
  undo: "Rückgängig (Strg+Z)",
  clear: "Alles löschen",
  export: "Standbild exportieren",
  exporting: "Standbild wird erstellt ...",
  close: "Zeichnen beenden (Esc)",
  errors: {
    "no-frame":
      "Das Standbild ist noch nicht geladen. Bitte kurz warten und erneut versuchen.",
    blocked:
      "Der Videoserver erlaubt keinen Zugriff auf das Bild, daher kann kein Standbild exportiert werden.",
    failed:
      "Das Standbild konnte nicht exportiert werden. Bitte erneut versuchen.",
  } satisfies Record<StillExportError, string>,
} as const;
