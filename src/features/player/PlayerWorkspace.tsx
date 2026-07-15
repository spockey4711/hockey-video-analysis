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
 * The broadcast-HUD frame for the watch/tagging workspace: a fixed full-viewport
 * grid that places the left rail, top bar, video, transport, bottom timeline and
 * right tags rail into named regions (backlog: use the layout-rail tokens). Purely
 * presentational and layering-neutral (no feature imports) - {@link ContinuousPlayer}
 * fills the regions from inside the player context so its children read the live
 * controller. The rail column runs full height on the left; the timeline spans the
 * main and aside columns along the bottom, matching the reference.
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
      className="grid h-[100dvh] overflow-hidden bg-[var(--bg-app)] text-[color:var(--text-primary)]"
      style={TEMPLATE}
    >
      <div
        style={{ gridArea: "rail" }}
        className="min-h-0 border-r border-[color:var(--border)] bg-[var(--surface)]"
      >
        {rail}
      </div>
      <div
        style={{ gridArea: "topbar" }}
        className="min-w-0 border-b border-[color:var(--border)] bg-[var(--surface)]"
      >
        {topBar}
      </div>
      <div
        style={{ gridArea: "main" }}
        className="flex min-h-0 min-w-0 flex-col bg-[var(--bg-base)]"
      >
        <div className="min-h-0 flex-1">{video}</div>
        {transport}
      </div>
      <aside
        style={{ gridArea: "aside" }}
        className="flex min-h-0 flex-col border-l border-[color:var(--border)] bg-[var(--surface)]"
      >
        {aside}
      </aside>
      <div
        style={{ gridArea: "timeline" }}
        className="min-w-0 border-t border-[color:var(--border)] bg-[var(--surface)]"
      >
        {timeline}
      </div>
    </div>
  );
}
