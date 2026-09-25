import type { Metadata } from "next";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <Heading level={1}>{list.title}</Heading>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {list.description}
        </p>
      </div>
      <Card className="p-[var(--space-4)]">
        <CreateSceneForm />
      </Card>
      <ScenesList scenes={scenes} />
    </main>
  );
}
