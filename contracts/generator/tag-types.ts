/**
 * `tag-types.json`: the taggable moment types, generated from the web app's
 * config (`src/lib/tag-types/config.ts`), which stays the one place to add or
 * retune a type. The Mac app reads this file instead of keeping its own list.
 */
import { TAG_TYPES } from "@/lib/tag-types";

export function buildTagTypes() {
  return {
    contract: "tag-types",
    description:
      "The tag types in display order. key is stored in tags.type and never " +
      "localized; label is the German display name; hotkey is the single key that " +
      "captures the type; tone is the semantic colour alias the chip and marker " +
      "use (each app maps it to its own theme colours); window is the type's " +
      "default clip window around a capture point in seconds (start = capture - " +
      "preS, end = capture + postS), which the team may replace per type " +
      "(GET /api/tag-windows, see contracts/README.md), so " +
      "rules take the window as an input rather than looking it up.",
    reference: ["src/lib/tag-types/config.ts"],
    types: TAG_TYPES.map((type) => ({
      key: type.key,
      label: type.label,
      hotkey: type.hotkey,
      tone: type.tone,
      window: { preS: type.window.preS, postS: type.window.postS },
    })),
  };
}
