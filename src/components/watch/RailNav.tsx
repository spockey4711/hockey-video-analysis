"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { watchContent } from "./content";

import { Icon, type IconName } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import { isNavItemActive } from "@/components/shell/nav-config";

interface RailNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * Game-contextual icon nav for the workspace rail. Client-side so it can read the
 * live pathname and mark the active section; the links stay plain `next/link`
 * anchors so navigation still works without JS. The items are contextual to the
 * game being tagged (Tagging points at this very watch route), so they live here
 * rather than in the shell's section nav.
 */
export function RailNav({ gameId }: { gameId: string }) {
  const pathname = usePathname();
  const { rail } = watchContent;

  const items: readonly RailNavItem[] = [
    { href: "/games", label: rail.games, icon: "film" },
    { href: `/games/${gameId}/watch`, label: rail.tagging, icon: "tag" },
    { href: "/collections", label: rail.share, icon: "share-2" },
  ];

  return (
    <nav aria-label={rail.nav}>
      <ul className="flex flex-col gap-[var(--space-1)]">
        {items.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-[var(--space-1)] rounded-[var(--radius-md)] px-[var(--space-1)] py-[var(--space-2)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                  active
                    ? "bg-[var(--surface-hover)] text-[color:var(--text-brand)]"
                    : "text-[color:var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
                )}
              >
                <Icon name={item.icon} size={20} />
                <span className="text-[length:var(--fs-micro)] leading-none [font-weight:var(--fw-medium)]">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
