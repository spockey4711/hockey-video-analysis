/**
 * Pure display mapper for the coach's collection insights: the viewing figures
 * (ADR 0009) and the comments of each clip in the collection, in the order the
 * curation checklist lists them. Kept pure and server-safe so the insights
 * section only receives display-ready values and the shaping is unit-tested
 * without a database.
 */
import type { CurationItem } from "./curation-items";

import { formatCommentDate } from "@/features/clips/comments/format-comment-date";
import { pinCoachComments } from "@/features/clips/comments/pinning";
import type { CommentRow } from "@/features/clips/comments/queries";
import {
  type CollectionViewStats,
  EMPTY_VIEW_COUNTS,
  type ViewCounts,
} from "@/features/share/views/stats";

/**
 * The coach reads comment times in the team's local time. The page renders on
 * the server, whose zone is not the coach's, so it is pinned here.
 */
export const INSIGHTS_TIME_ZONE = "Europe/Berlin";

/** One comment, display-ready. */
export interface InsightComment {
  readonly id: string;
  readonly author: string;
  readonly body: string;
  /** Posted by the coach while signed in; pinned and highlighted. */
  readonly isCoach: boolean;
  /** Creation time as ISO 8601, for the `<time>` element. */
  readonly createdAt: string;
  /** Formatted creation time, e.g. "22.09.2026, 14:05". */
  readonly date: string;
}

/** One clip of the collection with its figures and comments. */
export interface ClipInsight {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly counts: ViewCounts;
  /** Coach comments pinned first (newest on top), then the rest oldest first. */
  readonly comments: readonly InsightComment[];
}

/** Everything the insights section shows for one collection. */
export interface CollectionInsights {
  readonly summary: ViewCounts;
  readonly clips: readonly ClipInsight[];
  /** False while nobody has viewed or commented on any clip yet. */
  readonly hasActivity: boolean;
}

function hasViews(counts: ViewCounts): boolean {
  return (
    counts.clicks + counts.fullViews + counts.replays + counts.uniqueViewers > 0
  );
}

/**
 * Build the insights from the curation items (only the checked ones are in the
 * collection), the collection's view stats and its clips' comments. A clip
 * nobody opened counts zero; comments on clips outside the collection are
 * ignored.
 */
export function toCollectionInsights(
  items: readonly CurationItem[],
  stats: CollectionViewStats,
  comments: readonly CommentRow[],
  timeZone: string = INSIGHTS_TIME_ZONE,
): CollectionInsights {
  const byClip = new Map<string, InsightComment[]>();
  for (const comment of comments) {
    const list = byClip.get(comment.clipId) ?? [];
    const createdAt = comment.createdAt.toISOString();
    list.push({
      id: comment.id,
      author: comment.author,
      body: comment.body,
      isCoach: comment.isCoach,
      createdAt,
      date: formatCommentDate(createdAt, timeZone),
    });
    byClip.set(comment.clipId, list);
  }

  const clips = items
    .filter((item) => item.checked)
    .map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      counts: stats.clips[item.id] ?? EMPTY_VIEW_COUNTS,
      comments: pinCoachComments(byClip.get(item.id) ?? []),
    }));

  return {
    summary: stats.collection,
    clips,
    hasActivity:
      hasViews(stats.collection) ||
      clips.some((clip) => clip.comments.length > 0),
  };
}
