import type { Metadata } from "next";

import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { AccountSummary, SettingsSection } from "@/components/settings";
import { ThemeChoice } from "@/components/shell/ThemeChoice";
import { requireCoach } from "@/features/access";
import { gameFormatContent, TeamFormatForm } from "@/features/game-format";
import { getTeamGameFormat } from "@/features/game-format/queries";
import { ChangePasswordForm, settingsContent } from "@/features/settings";
import { DeviceList, toDeviceRows } from "@/features/settings/devices";
import { PresentationScaleChoice } from "@/features/share/presentation";
import { teamShareContent, TeamShareSettings } from "@/features/share/team";
import { tagWindowsContent, TagWindowsForm } from "@/features/tag-windows";
import { getTagWindows } from "@/features/tag-windows/queries";
import { getCurrentSession, listSessions } from "@/lib/auth";

// Coach-only account surface; keep it out of search indexes like the roster.
export const metadata: Metadata = {
  title: settingsContent.title,
  robots: { index: false, follow: false },
};

/**
 * Coach settings: a read-only account summary, a change-password form, the
 * team's default game format, its clip window per tag type, the team link
 * (Teilen) with the control that creates or replaces it, the display choices of this device (design and
 * presentation text size) and the Geräte list, where the coach signs out this
 * browser, any other one or the Mac app. Profile edits are out of scope; player
 * links are renewed on the roster.
 */
export default async function SettingsPage() {
  const coach = await requireCoach("/settings");
  // `requireCoach` just validated this browser's session (cached per request).
  const session = await getCurrentSession();
  const [teamFormat, sessions, tagWindows] = await Promise.all([
    getTeamGameFormat(),
    listSessions(coach.id),
    getTagWindows(),
  ]);
  const deviceRows = toDeviceRows(
    sessions,
    session?.publicId ?? "",
    new Date(),
  );
  const { account, password, appearance, devices } = settingsContent;
  const { team } = gameFormatContent;

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

      <SettingsSection title={team.title} description={team.description}>
        <TeamFormatForm format={teamFormat} />
      </SettingsSection>

      <SettingsSection
        id="tag-fenster"
        title={tagWindowsContent.title}
        description={tagWindowsContent.description}
      >
        <TagWindowsForm windows={tagWindows} />
      </SettingsSection>

      <SettingsSection
        id="teilen"
        title={teamShareContent.settings.title}
        description={teamShareContent.settings.description}
      >
        <TeamShareSettings baseUrl={process.env.NEXT_PUBLIC_APP_URL} />
      </SettingsSection>

      <SettingsSection
        title={appearance.title}
        description={appearance.description}
      >
        <ThemeChoice />
        <PresentationScaleChoice />
      </SettingsSection>

      <SettingsSection
        id="geraete"
        title={devices.title}
        description={devices.description}
      >
        <DeviceList rows={deviceRows} />
      </SettingsSection>
    </PageContainer>
  );
}
