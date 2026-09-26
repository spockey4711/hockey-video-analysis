import type { Metadata } from "next";

import { Card } from "@/components/core/Card";
import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { requireCoach } from "@/features/access";
import { GameForm, gamesContent } from "@/features/games";
import { playbackBaseUrl } from "@/features/player/player-sources";

const { create, list } = gamesContent;

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: create.title,
  robots: { index: false, follow: false },
};

/** Create a game and attach its ordered chapter files. */
export default async function NewGamePage() {
  await requireCoach("/games/new");

  return (
    <PageContainer width="form">
      <PageHeader
        back={{ href: "/games", label: list.title }}
        title={create.title}
        subtitle={create.subtitle}
      />
      <Card accent className="p-[var(--space-8)]">
        <GameForm
          mediaBaseUrl={playbackBaseUrl({
            baseUrl: process.env.MEDIA_BASE_URL,
            proxyBaseUrl: process.env.MEDIA_PROXY_BASE_URL,
          })}
        />
      </Card>
    </PageContainer>
  );
}
