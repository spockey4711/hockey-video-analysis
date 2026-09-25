import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Heading } from "@/components/core/Heading";
import { requireCoach } from "@/features/access";
import {
  SceneEditor,
  getScene,
  isValidSceneId,
  listBoardRoster,
  tacticsContent,
} from "@/features/tactics";

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: tacticsContent.list.title,
  robots: { index: false, follow: false },
};

/**
 * One tactics scene on the board: place and move both teams and the ball,
 * draw lines and arrows, and save, rename, duplicate or delete the scene. An
 * unknown or malformed id is a 404.
 */
export default async function TacticsScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/tactics/${id}`);
  if (!isValidSceneId(id)) notFound();

  const [scene, roster] = await Promise.all([getScene(id), listBoardRoster()]);
  if (!scene) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-6)] sm:px-[var(--space-6)] sm:py-[var(--space-8)]">
      <div>
        <Link
          href="/tactics"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] underline-offset-2 hover:underline"
        >
          {tacticsContent.editor.back}
        </Link>
      </div>
      <Heading level={1} className="break-words">
        {scene.name}
      </Heading>
      <SceneEditor
        sceneId={scene.id}
        name={scene.name}
        scene={scene.scene}
        roster={roster}
      />
    </main>
  );
}
