/**
 * Golden vectors for the part rules: which files of a game folder (on Drive,
 * on the SSD or on a camera card) are the game, and in what order.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import { MAX_SOURCES } from "@/features/games/validation";
import { selectGameParts } from "@/features/ingest/parts";

function partsCase(name: string, fileNames: string[]) {
  return vectorCase(name, "selectGameParts", { fileNames }, (i) => {
    const result = selectGameParts(i.fileNames);
    // The reason is English log text; a port reports the same outcome in
    // its own words, so only the outcome is pinned.
    return result.kind === "invalid" ? { kind: "invalid" } : result;
  });
}

/** One more part than a game may have: 101 one-chapter recordings. */
function tooManyRecordings(): string[] {
  return Array.from(
    { length: MAX_SOURCES + 1 },
    (_, i) => `GX01${String(i + 1).padStart(4, "0")}.MP4`,
  );
}

export function buildGameParts(): VectorFile {
  return {
    contract: "game-parts",
    description:
      "The game parts among a folder's file names, in play order. Three schemes " +
      "count, matched case-insensitively: halbzeit<N> and viertel<N> (.mp4 or " +
      ".mov), and GoPro chapters G[XH]<CC><NNNN>.MP4 ordered by recording NNNN, " +
      "then chapter CC. Other files are ignored and listed in code-unit order. A " +
      "folder mixing schemes, repeating or skipping a part, or holding more than " +
      "maxParts parts is invalid (its English reason is left out).",
    reference: ["src/features/ingest/parts.ts"],
    tolerance: DEFAULT_TOLERANCE,
    constants: { maxParts: MAX_SOURCES },
    cases: [
      partsCase("GoPro chapters in any listing order", [
        "GX020042.MP4",
        "GX030042.MP4",
        "GX010042.MP4",
      ]),
      partsCase("two recordings play in recording order", [
        "GX010043.MP4",
        "GX020042.MP4",
        "GX010042.MP4",
      ]),
      partsCase("H.264 chapters", ["GH020007.MP4", "GH010007.MP4"]),
      partsCase("HEVC and H.264 recordings are one scheme", [
        "GX010008.MP4",
        "GH010007.MP4",
      ]),
      partsCase("lower-case names", ["gx020042.mp4", "gx010042.mp4"]),
      partsCase("a camera card's side files are ignored", [
        "GX010042.MP4",
        "GX010042.THM",
        "GL010042.LRV",
        "GX020042.MP4",
        "GL020042.LRV",
      ]),
      partsCase("other files in a game folder are ignored", [
        "notes.txt",
        "GX010042.MP4",
        "Tor.MOV",
        "cover.jpg",
      ]),
      partsCase("exported halves", ["Halbzeit 2.mp4", "halbzeit1.mp4"]),
      partsCase("exported quarters", [
        "Viertel_3.MOV",
        "viertel1.mp4",
        "Viertel-2.mp4",
        "viertel4.mov",
      ]),
      partsCase("a folder without parts", ["notes.txt", "cover.jpg"]),
      partsCase("an empty folder", []),
      partsCase("mixed schemes are invalid", ["halbzeit1.mp4", "GX010042.MP4"]),
      partsCase("a repeated part is invalid", [
        "halbzeit1.mp4",
        "Halbzeit 1.mp4",
      ]),
      partsCase("a missing chapter is invalid", [
        "GX010042.MP4",
        "GX030042.MP4",
      ]),
      partsCase("a recording without its first chapter is invalid", [
        "GX020042.MP4",
      ]),
      partsCase("a missing half is invalid", ["halbzeit2.mp4"]),
      partsCase(
        "more parts than a game may have is invalid",
        tooManyRecordings(),
      ),
    ],
  };
}
