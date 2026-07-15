/**
 * Deterministic identity helpers for `PlayerChip`: the same player name always
 * yields the same initials and the same avatar color, with no persisted state.
 * The palette is drawn from semantic design tokens (never raw hex), so avatars
 * stay on-brand across the app.
 */

/** Token-based avatar backgrounds; index chosen deterministically from the name. */
const AVATAR_PALETTE: readonly string[] = [
  "bg-[var(--tag-tor)] text-[color:var(--tag-tor-ink)]",
  "bg-[var(--tag-ecke)] text-[color:var(--tag-ecke-ink)]",
  "bg-[var(--tag-gut)] text-[color:var(--tag-gut-ink)]",
  "bg-[var(--tag-schlecht)] text-[color:var(--tag-schlecht-ink)]",
  "bg-[var(--tag-whistle)] text-[color:var(--tag-whistle-ink)]",
  "bg-[var(--turf-500)] text-[color:var(--ink-950)]",
];

/** Stable non-negative hash of a string (small djb2-style mix). */
function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Up to two uppercase initials (first + last word); `"?"` for a blank name. */
export function playerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Deterministic avatar color class for a player name (token-based fill + ink). */
export function playerAvatarClass(name: string): string {
  return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
}
