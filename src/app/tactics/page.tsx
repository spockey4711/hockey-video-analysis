import type { Metadata } from "next";

import { Card } from "@/components/core/Card";
import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { requireCoach } from "@/features/access";
import {
  CreateSceneForm,
  ScenesList,
  listScenes,
  tacticsContent,
} from "@/features/tactics";

const { list } = tacticsContent;

// Coach-only workspace; keep it out of search indexes.
export const metadata: Metadata = {
  title: list.title,
  robots: { index: false, follow: false },
};

/**
 * The tactics board's scene list: every saved scene with a control to create
 * the next one, each linking to its board (ADR 0010).
 */
export default async function TacticsPage() {
  await requireCoach("/tactics");
  const scenes = await listScenes();

  return (
    <PageContainer>
      <PageHeader title={list.title} subtitle={list.description} />
      <Card className="p-[var(--space-4)]">
        <CreateSceneForm />
      </Card>
      <ScenesList scenes={scenes} />
    </PageContainer>
  );
}
