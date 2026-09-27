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
  InlineRename,
  renameSceneAction,
} from "@/features/tactics";
import {
  executionStats,
  listSceneExecutions,
  SceneExecutions,
  toExecutionRows,
} from "@/features/tactics/executions";

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: tacticsContent.list.title,
  robots: { index: false, follow: false },
};

/**
 * One tactics scene on the board: place and move both teams and the ball,
 * draw lines and arrows, and save, rename, duplicate or delete the scene.
 * Below the board, the scene's executions: the tagged moments where the team
 * played it and how they went (plan vs reality). An unknown or malformed id
 * is a 404.
 */
export default async function TacticsScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/tactics/${id}`);
  if (!isValidSceneId(id)) notFound();

  const [scene, roster, executions] = await Promise.all([
    getScene(id),
    listBoardRoster(),
    listSceneExecutions(id),
  ]);
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
      <InlineRename
        idField="sceneId"
        id={scene.id}
        name={scene.name}
        action={renameSceneAction}
        fieldLabel={tacticsContent.editor.nameLabel}
        openLabel={tacticsContent.rename.scene(scene.name)}
        title
      >
        <Heading level={1} className="min-w-0 break-words">
          {scene.name}
        </Heading>
      </InlineRename>
      <SceneEditor
        sceneId={scene.id}
        name={scene.name}
        category={scene.category}
        tags={scene.tags}
        scene={scene.scene}
        coachingNotes={scene.coachingNotes}
        roster={roster}
      />
      <SceneExecutions
        sceneId={scene.id}
        stats={executionStats(executions.map((row) => row.outcome))}
        rows={toExecutionRows(executions)}
        playable={
          executions.filter((execution) => execution.clip?.status === "ready")
            .length
        }
      />
    </main>
  );
}
