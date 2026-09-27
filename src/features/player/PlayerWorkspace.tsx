import type { CSSProperties, ReactNode } from "react";

export interface PlayerWorkspaceProps {
  /** Left icon rail: full-height, game-contextual navigation. */
  readonly rail: ReactNode;
  /** Top bar spanning the main column: title, chapter readout, primary action. */
  readonly topBar: ReactNode;
  /** The video frame; fills the remaining vertical space in the main column. */
  readonly video: ReactNode;
  /** Transport bar directly under the video: controls, clock, tag buttons. */
  readonly transport: ReactNode;
  /** Full-width chapter timeline along the bottom. */
  readonly timeline: ReactNode;
  /** Right rail: the tags list and the selected-tag detail panel. */
  readonly aside: ReactNode;
}

/**
 * The broadcast-HUD frame for the watch/tagging workspace. Purely presentational
 * and layering-neutral (no feature imports) - {@link ContinuousPlayer} fills the
 * regions from inside the player context so its children read the live
 * controller.
 *
 * From the `lg` breakpoint up it is a fixed full-viewport grid that places the
 * left rail, top bar, video, transport, bottom timeline and right tags rail into
 * named regions (backlog: use the layout-rail tokens). The rail column runs full
 * height on the left; the timeline spans the main and aside columns along the
 * bottom, matching the reference.
 *
 * Below `lg` (a phone, or a tablet held upright) three columns do not fit, so the
 * regions stack in reading order: the rail as a strip across the top, the top
 * bar, the full-width video with its transport, then the timeline and the tags
 * rail. The grid template is only read while the container is a grid, so the
 * stacked flex column ignores it. On a screen tall enough, the stack fills the
 * viewport and only the timeline and tags scroll, in their own region under the
 * player, so the video and the tag buttons stay in view and in reach while the
 * coach works through the tags. A short screen (a phone on its side) has no room
 * for that split and scrolls as one page instead.
 */
const TEMPLATE: CSSProperties = {
  gridTemplateColumns: "var(--rail-w) minmax(0, 1fr) var(--sidebar-w)",
  gridTemplateRows: "var(--topbar-h) minmax(0, 1fr) var(--timeline-h)",
  gridTemplateAreas: `
    "rail topbar aside"
    "rail main aside"
    "rail timeline timeline"
  `,
};

export function PlayerWorkspace({
  rail,
  topBar,
  video,
  transport,
  timeline,
  aside,
}: PlayerWorkspaceProps) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[var(--bg-app)] text-[color:var(--text-primary)] lg:grid lg:h-[100dvh] lg:overflow-hidden max-lg:[@media(min-height:36rem)]:h-[100dvh]"
      style={TEMPLATE}
    >
      <div
        style={{ gridArea: "rail" }}
        className="shrink-0 border-b border-[color:var(--border)] bg-[var(--surface)] lg:min-h-0 lg:border-r lg:border-b-0"
      >
        {rail}
      </div>
      <div
        style={{ gridArea: "topbar" }}
        className="h-[var(--topbar-h)] min-w-0 shrink-0 border-b border-[color:var(--border)] bg-[var(--surface)] lg:h-auto"
      >
        {topBar}
      </div>
      <div
        style={{ gridArea: "main" }}
        className="flex min-w-0 shrink-0 flex-col bg-[var(--bg-base)] lg:min-h-0"
      >
        <div className="aspect-video max-h-[50dvh] w-full lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1">
          {video}
        </div>
        {transport}
      </div>
      {/* The stacked layout's scroll region; on the grid it steps aside
          (`contents`) so the timeline and aside land in their own areas. */}
      <div className="flex flex-1 flex-col lg:contents max-lg:[@media(min-height:36rem)]:min-h-0 max-lg:[@media(min-height:36rem)]:overflow-y-auto">
        <div
          style={{ gridArea: "timeline" }}
          className="min-w-0 border-t border-[color:var(--border)] bg-[var(--surface)]"
        >
          {timeline}
        </div>
        <aside
          style={{ gridArea: "aside" }}
          className="flex min-w-0 flex-1 flex-col border-t border-[color:var(--border)] bg-[var(--surface)] lg:min-h-0 lg:border-t-0 lg:border-l"
        >
          {aside}
        </aside>
      </div>
    </div>
  );
}
