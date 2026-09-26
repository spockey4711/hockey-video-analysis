import type { Metadata } from "next";

import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { AccountSummary, SettingsSection } from "@/components/settings";
import { ThemeChoice } from "@/components/shell/ThemeChoice";
import { requireCoach, SignOutForm } from "@/features/access";
import { ChangePasswordForm, settingsContent } from "@/features/settings";
import { PresentationScaleChoice } from "@/features/share/presentation";

// Coach-only account surface; keep it out of search indexes like the roster.
export const metadata: Metadata = {
  title: settingsContent.title,
  robots: { index: false, follow: false },
};

/**
 * Coach settings: a read-only account summary, a change-password form, the
 * display choices of this device (design and presentation text size) and a
 * sign-out control. The first cut of P2-15 - profile edits and share-token
 * rotation are deliberately out of scope.
 */
export default async function SettingsPage() {
  const coach = await requireCoach("/settings");
  const { account, password, appearance, session } = settingsContent;

  return (
    <PageContainer>
      <PageHeader
        title={settingsContent.title}
        subtitle={settingsContent.subtitle}
      />

      <SettingsSection title={account.title}>
        <AccountSummary name={coach.name} email={coach.email} />
      </SettingsSection>

      <SettingsSection
        title={password.title}
        description={password.description}
      >
        <ChangePasswordForm email={coach.email} />
      </SettingsSection>

      <SettingsSection
        title={appearance.title}
        description={appearance.description}
      >
        <ThemeChoice />
        <PresentationScaleChoice />
      </SettingsSection>

      <SettingsSection title={session.title} description={session.signOutHint}>
        <SignOutForm variant="secondary" />
      </SettingsSection>
    </PageContainer>
  );
}
