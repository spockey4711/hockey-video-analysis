/**
 * The name link of a scene or formation list row. Its `::after` stretches over
 * the whole card (the nearest positioned ancestor), so a click anywhere on the
 * row opens it, while the row's own controls, positioned and later in the
 * markup, stay clickable above it. The focus ring is drawn on the stretched
 * area, so a keyboard user sees the whole row as the target.
 */
export const ROW_LINK_CLASS =
  "min-w-0 truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)] after:absolute after:inset-0 after:rounded-[var(--radius-lg)] after:content-[''] focus-visible:outline-none focus-visible:after:shadow-[var(--glow-turf)]";
