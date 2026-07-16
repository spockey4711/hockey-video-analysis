import { settingsContent } from "@/features/settings";

const { account } = settingsContent;

const TERM_CLASS =
  "text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] uppercase tracking-[var(--ls-wide)] text-[color:var(--text-secondary)]";
const VALUE_CLASS =
  "text-[length:var(--fs-body)] text-[color:var(--text-primary)]";

/**
 * Read-only summary of the signed-in coach's account. Editing name and email is
 * deliberately out of the settings page's first cut (see P2-15).
 */
export function AccountSummary({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return (
    <dl className="flex flex-col gap-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <dt className={TERM_CLASS}>{account.nameLabel}</dt>
        <dd className={VALUE_CLASS}>{name}</dd>
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <dt className={TERM_CLASS}>{account.emailLabel}</dt>
        <dd className={VALUE_CLASS}>{email}</dd>
      </div>
    </dl>
  );
}
