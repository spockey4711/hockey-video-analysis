import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/core/Card";
import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { PanelHeader } from "@/components/core/PanelHeader";
import { requireCoach } from "@/features/access";
import { gameFormatContent, GameFormatForm } from "@/features/game-format";
import { loadGameFormatSetting } from "@/features/game-format/queries";

const { settings, game: gameCopy } = gameFormatContent;

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: settings.title,
  robots: { index: false, follow: false },
};

/**
 * One game's settings: for now its format, the team default or its own period
 * count and length. Coach-only, like the rest of the games workspace; an
 * unknown game id 404s.
 */
export default async function GameSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/games/${id}/settings`);

  const setting = await loadGameFormatSetting(id);
  if (!setting) notFound();

  const { override } = setting;
  const hasOwnFormat =
    override.periodCount !== null || override.periodLengthS !== null;

  return (
    <PageContainer width="form">
      <PageHeader
        back={{ href: `/games/${id}/watch`, label: settings.back }}
        title={settings.title}
        subtitle={setting.title}
      />
      <Card
        as="section"
        aria-labelledby="game-format-heading"
        accent
        className="flex flex-col gap-[var(--space-4)] p-[var(--space-8)]"
      >
        <PanelHeader
          size="sub"
          title={gameCopy.heading}
          titleId="game-format-heading"
          hint={gameCopy.hint}
        />
        <GameFormatForm
          gameId={id}
          teamDefault={setting.teamDefault}
          format={hasOwnFormat ? setting.format : null}
          markedPeriods={setting.markedPeriods}
        />
      </Card>
    </PageContainer>
  );
}
