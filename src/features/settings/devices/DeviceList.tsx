import { settingsContent } from "../content";

import { SignOutDeviceForm } from "./SignOutDeviceForm";
import { SignOutOtherDevicesForm } from "./SignOutOtherDevicesForm";
import type { DeviceRow } from "./rows";

import { Icon } from "@/components/core/Icon";

const { devices } = settingsContent;

/**
 * Einstellungen > Geräte: every browser and Mac the coach is signed in on,
 * this browser first and marked, each with "Abmelden", and "Alle anderen
 * abmelden" while there is anyone else to sign out.
 */
export function DeviceList({ rows }: { rows: readonly DeviceRow[] }) {
  const hasOthers = rows.some((row) => !row.current);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <ul
        aria-label={devices.listLabel}
        className="flex flex-col divide-y divide-[color:var(--border-subtle)] rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)]"
      >
        {rows.map((row) => (
          <li
            key={row.publicId}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)] px-[var(--space-3)] py-[var(--space-3)] sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <Icon
              name={row.icon}
              size={20}
              className="shrink-0 text-[color:var(--text-secondary)]"
            />
            <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                <span className="min-w-0 text-[length:var(--fs-body)] [font-weight:var(--fw-medium)] break-words text-[color:var(--text-primary)]">
                  {row.name}
                </span>
                {row.current && (
                  <span className="rounded-[var(--radius-pill)] bg-[var(--accent)] px-[var(--space-2)] py-0.5 text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] text-[color:var(--accent-ink)]">
                    {devices.thisDevice}
                  </span>
                )}
              </div>
              <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
                {row.kindLabel} · {row.lastUsed}
              </span>
            </div>
            {/* Under the text on a phone, so the name keeps the row's width. */}
            <div className="col-start-2 sm:col-start-3">
              <SignOutDeviceForm publicId={row.publicId} name={row.name} />
            </div>
          </li>
        ))}
      </ul>
      {hasOthers && <SignOutOtherDevicesForm />}
    </div>
  );
}
