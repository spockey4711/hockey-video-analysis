import { homeContent } from "./content";
import { DEMO_GAME, markerLeftPercent, quarterBoundariesS } from "./timeline";

import { Card } from "@/components/core/Card";
import { cn } from "@/components/core/cn";
import { TagChip, type TagChipType } from "@/components/data/TagChip";
import { formatDuration } from "@/features/games";
import { getTagType } from "@/lib/tag-types";

const { timeline } = homeContent;

/** The tag types the legend teaches, in the app's capture order plus the AI hint. */
const LEGEND_TYPES: readonly TagChipType[] = [
  "goal",
  "corner_short",
  "action_good",
  "action_bad",
  "whistle",
];

/** Each marker's dot/stem colour, keyed to the same `--tag-*` tokens as `TagChip`. */
const MARKER_COLOR: Record<TagChipType, string> = {
  goal: "var(--tag-tor)",
  corner_short: "var(--tag-ecke)",
  action_good: "var(--tag-gut)",
  action_bad: "var(--tag-schlecht)",
  whistle: "var(--tag-whistle)",
};

/** German label for a marker's hover title: config for real types, local for the AI hint. */
function markerLabel(type: TagChipType): string {
  return type === "whistle" ? "Vorschlag" : (getTagType(type)?.label ?? type);
}

/**
 * The landing-page hero signature: a mock game timeline that shows, at a glance,
 * what the product does. A monospace timecode ruler and four quarter segments
 * frame a set of colour-coded tag markers that pop in on load (pure CSS, so this
 * stays a server component and honours `prefers-reduced-motion` - see the
 * `home-tag-marker` rule in globals.css). The legend below names each colour.
 */
export function GameTimeline({ className }: { className?: string }) {
  const boundaries = quarterBoundariesS(DEMO_GAME);

  return (
    <Card
      as="section"
      accent
      aria-label={timeline.caption}
      className={cn(
        "flex flex-col gap-[var(--space-4)] p-[var(--space-5)]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-[var(--space-4)]">
        <span className="[font-family:var(--font-mono)] text-[length:var(--fs-caption)] tracking-[var(--ls-caps)] text-[color:var(--text-muted)] uppercase">
          {timeline.caption}
        </span>
        <span className="[font-family:var(--font-mono)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {formatDuration(DEMO_GAME.totalS)}
        </span>
      </div>

      {/* Timecode ruler - one label per quarter boundary, evenly spaced. */}
      <div className="flex justify-between [font-family:var(--font-mono)] text-[length:var(--fs-micro)] text-[color:var(--text-muted)]">
        {boundaries.map((atS) => (
          <span key={atS}>{formatDuration(atS)}</span>
        ))}
      </div>

      {/* The track: quarter dividers + labels behind, tag markers on top. */}
      <div className="relative h-[72px] rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)]">
        {/* Quarter labels, centred in each segment. */}
        {Array.from({ length: DEMO_GAME.quarters }, (_, i) => (
          <span
            key={`q-${i}`}
            className="absolute bottom-[var(--space-1)] -translate-x-1/2 [font-family:var(--font-mono)] text-[length:var(--fs-micro)] text-[color:var(--text-muted)]"
            style={{ left: `${((i + 0.5) / DEMO_GAME.quarters) * 100}%` }}
          >
            {timeline.quarterLabel(i + 1)}
          </span>
        ))}

        {/* Interior segment dividers (skip the two ends). */}
        {boundaries.slice(1, -1).map((atS) => (
          <span
            key={`div-${atS}`}
            aria-hidden
            className="absolute inset-y-0 w-px bg-[color:var(--border-subtle)]"
            style={{ left: `${markerLeftPercent(atS, DEMO_GAME.totalS)}%` }}
          />
        ))}

        {/* Tagged moments. */}
        <ul aria-hidden className="absolute inset-0">
          {DEMO_GAME.markers.map((marker, i) => {
            const color = MARKER_COLOR[marker.type];
            return (
              <li
                key={`${marker.type}-${marker.atS}`}
                className="absolute bottom-0 -translate-x-1/2"
                style={{
                  left: `${markerLeftPercent(marker.atS, DEMO_GAME.totalS)}%`,
                }}
                title={`${markerLabel(marker.type)} · ${formatDuration(marker.atS)}`}
              >
                <span
                  className="home-tag-marker flex flex-col items-center"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <span
                    className="h-[10px] w-[10px] rounded-full"
                    style={{
                      background: color,
                      boxShadow: "0 0 0 3px var(--surface-inset)",
                    }}
                  />
                  <span
                    className="h-[42px] w-[2px]"
                    style={{
                      backgroundImage: `linear-gradient(to bottom, ${color}, transparent)`,
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {timeline.hint}
      </p>

      <ul className="flex flex-wrap gap-[var(--space-2)]">
        {LEGEND_TYPES.map((type) => (
          <li key={type}>
            <TagChip type={type} size="sm" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
