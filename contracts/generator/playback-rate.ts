/**
 * Golden vectors for the playback-speed ladder: the rates the player offers,
 * cycling the speed control, the up and down keys held at the ends, and the
 * German label of a rate.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  adjustPlaybackRate,
  formatPlaybackRate,
  nextPlaybackRate,
  PLAYBACK_RATES,
} from "@/features/player/playback-rate";

function nextCase(name: string, current: number) {
  return vectorCase(name, "nextPlaybackRate", { current }, (i) =>
    nextPlaybackRate(i.current),
  );
}

function adjustCase(name: string, current: number, direction: 1 | -1) {
  return vectorCase(name, "adjustPlaybackRate", { current, direction }, (i) =>
    adjustPlaybackRate(i.current, i.direction),
  );
}

function formatCase(name: string, rate: number) {
  return vectorCase(name, "formatPlaybackRate", { rate }, (i) =>
    formatPlaybackRate(i.rate),
  );
}

export function buildPlaybackRate(): VectorFile {
  return {
    contract: "playback-rate",
    description:
      "The playback rates from slow motion to fast scan, slowest first. " +
      "nextPlaybackRate cycles the speed control and wraps from the top to the " +
      "slowest; adjustPlaybackRate moves one rung up (1) or down (-1) and holds " +
      "at the ends. An unknown current rate falls back to normal speed in both. " +
      "formatPlaybackRate labels a rate with the German decimal comma.",
    reference: ["src/features/player/playback-rate.ts"],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      vectorCase("the rates, slowest first", "playbackRates", {}, () => [
        ...PLAYBACK_RATES,
      ]),

      nextCase("cycling from normal speed", 1),
      nextCase("cycling from slow motion", 0.25),
      nextCase("cycling wraps from the top", 4),
      nextCase("cycling from an unknown rate", 3),

      adjustCase("up from normal speed", 1, 1),
      adjustCase("down from normal speed", 1, -1),
      adjustCase("up holds at the top", 4, 1),
      adjustCase("down holds at the slowest", 0.25, -1),
      adjustCase("up from an unknown rate", 1.5, 1),
      adjustCase("down from an unknown rate", 0.75, -1),

      formatCase("a quarter speed", 0.25),
      formatCase("half speed", 0.5),
      formatCase("normal speed", 1),
      formatCase("double speed", 2),
      formatCase("four times", 4),
    ],
  };
}
