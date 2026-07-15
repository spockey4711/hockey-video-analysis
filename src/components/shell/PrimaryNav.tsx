"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, PRIMARY_NAV } from "./nav-config";

import { cn } from "@/components/core";

/**
 * Primary section nav for the coach top bar. Client-side so it can read the live
 * pathname and mark the active section; the links stay plain `next/link` anchors
 * so navigation still works without JS.
 */
export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Hauptnavigation">
      <ul className="flex items-center gap-[var(--space-1)]">
        {PRIMARY_NAV.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-[var(--control-sm)] items-center rounded-[var(--radius-sm)] px-[var(--space-3)] text-[length:var(--fs-body-sm)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                  active
                    ? "bg-[var(--surface-hover)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]"
                    : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
