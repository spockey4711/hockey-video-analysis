import type { Metadata } from "next";

import { Heading } from "@/components/core/Heading";
import { AccountSummary, SettingsSection } from "@/components/settings";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { requireCoach, SignOutForm } from "@/features/access";
import { ChangePasswordForm, settingsContent } from "@/features/settings";

// Coach-only account surface; keep it out of search indexes like the roster.
export const metadata: Metadata = {
  title: settingsContent.title,
  robots: { index: false, follow: false },
};

/**
 * Coach settings: a read-only account summary, a change-password form, the theme
 * toggle and a sign-out control. The first cut of P2-15 - profile edits and
 * share-token rotation are deliberately out of scope.
 */
export default async function SettingsPage() {
  const coach = await requireCoach("/settings");
  const { account, password, appearance, session } = settingsContent;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <header className="flex flex-col gap-[var(--space-1)]">
        <Heading level={1}>{settingsContent.title}</Heading>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {settingsContent.subtitle}
        </p>
      </header>

      <SettingsSection title={account.title}>
        <AccountSummary name={coach.name} email={coach.email} />
      </SettingsSection>

      <SettingsSection
        title={password.title}
        description={password.description}
      >
        <ChangePasswordForm />
      </SettingsSection>

      <SettingsSection
        title={appearance.title}
        description={appearance.themeHint}
      >
        <div className="flex items-center justify-between gap-[var(--space-4)]">
          <span className="text-[length:var(--fs-body)] text-[color:var(--text-primary)]">
            {appearance.themeLabel}
          </span>
          <ThemeToggle />
        </div>
      </SettingsSection>

      <SettingsSection title={session.title} description={session.signOutHint}>
        <div>
          <SignOutForm />
        </div>
      </SettingsSection>
    </main>
  );
}
