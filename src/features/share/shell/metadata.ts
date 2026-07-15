import type { Metadata } from "next";

/**
 * Robots directives every secret-link surface must carry. Share tokens are
 * secrets, so team and per-player views must stay out of search indexes and
 * archives - spread this into each share page/layout's `metadata` (or generator)
 * so a leaked link is never crawled, cached or listed. See ADR/CLAUDE.md
 * "secret-link surfaces are login-free and must not leak".
 */
export const shareRobots: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
};

/** Baseline metadata for share surfaces; extend with a page title as needed. */
export const shareMetadata: Metadata = {
  robots: shareRobots,
};
