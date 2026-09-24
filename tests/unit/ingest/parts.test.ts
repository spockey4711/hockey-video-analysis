import { describe, expect, it } from "vitest";

import { selectGameParts } from "@/features/ingest";

describe("selectGameParts", () => {
  it("orders exported halves by number, ignoring case and spacing", () => {
    expect(
      selectGameParts(["Halbzeit 2.MP4", "halbzeit1.mp4", "notes.txt"]),
    ).toEqual({
      kind: "parts",
      scheme: "halbzeit",
      parts: ["halbzeit1.mp4", "Halbzeit 2.MP4"],
      ignored: ["notes.txt"],
    });
  });

  it("orders quarters numerically, not alphabetically", () => {
    const names = Array.from({ length: 10 }, (_, i) => `viertel${i + 1}.mp4`);
    const result = selectGameParts([...names].reverse());
    expect(result).toMatchObject({ kind: "parts", parts: names });
  });

  it("ignores files that are not parts, such as a goal clip", () => {
    expect(
      selectGameParts([
        "TorBWK.MP4",
        "Viertel3.mp4",
        "Viertel1.mp4",
        "Viertel2.mp4",
      ]),
    ).toEqual({
      kind: "parts",
      scheme: "viertel",
      parts: ["Viertel1.mp4", "Viertel2.mp4", "Viertel3.mp4"],
      ignored: ["TorBWK.MP4"],
    });
  });

  it("orders GoPro chapters by recording, then chapter", () => {
    expect(
      selectGameParts([
        "GX020124.MP4",
        "GX010124.MP4",
        "GX030123.MP4",
        "GX010123.MP4",
        "GX020123.MP4",
        "GX010123.THM",
        "GL010123.LRV",
      ]),
    ).toEqual({
      kind: "parts",
      scheme: "gopro",
      parts: [
        "GX010123.MP4",
        "GX020123.MP4",
        "GX030123.MP4",
        "GX010124.MP4",
        "GX020124.MP4",
      ],
      ignored: ["GL010123.LRV", "GX010123.THM"],
    });
  });

  it("accepts H.264 GoPro chapters (GH) like HEVC ones (GX)", () => {
    expect(selectGameParts(["gh020001.mp4", "GH010001.MP4"])).toMatchObject({
      kind: "parts",
      parts: ["GH010001.MP4", "gh020001.mp4"],
    });
  });

  it("reports a folder without parts as none", () => {
    expect(selectGameParts(["Strafenkatalog.pdf", "TorBWK.MP4"])).toEqual({
      kind: "none",
      ignored: ["Strafenkatalog.pdf", "TorBWK.MP4"],
    });
    expect(selectGameParts([])).toEqual({ kind: "none", ignored: [] });
  });

  it("rejects a folder that mixes naming schemes", () => {
    expect(selectGameParts(["halbzeit1.mp4", "viertel1.mp4"])).toEqual({
      kind: "invalid",
      reason: "the folder mixes halbzeit and viertel files",
    });
  });

  it("rejects a part that appears twice", () => {
    expect(selectGameParts(["viertel1.mp4", "Viertel1.mov"])).toEqual({
      kind: "invalid",
      reason: "viertel1 appears twice (Viertel1.mov, viertel1.mp4)",
    });
  });

  it("rejects a gap in the numbering", () => {
    expect(
      selectGameParts(["viertel1.mp4", "viertel2.mp4", "viertel4.mp4"]),
    ).toEqual({ kind: "invalid", reason: "viertel3 is missing" });
    expect(selectGameParts(["halbzeit2.mp4"])).toEqual({
      kind: "invalid",
      reason: "halbzeit1 is missing",
    });
    expect(selectGameParts(["GX010123.MP4", "GX030123.MP4"])).toEqual({
      kind: "invalid",
      reason: "GoPro recording 123 chapter 2 is missing",
    });
  });

  it("rejects more parts than a game may have", () => {
    const names = Array.from(
      { length: 101 },
      (_, i) =>
        `GX${String((i % 99) + 1).padStart(2, "0")}${String(Math.floor(i / 99) + 1).padStart(4, "0")}.MP4`,
    );
    expect(selectGameParts(names)).toEqual({
      kind: "invalid",
      reason: "the folder has 101 parts, more than 100",
    });
  });
});
