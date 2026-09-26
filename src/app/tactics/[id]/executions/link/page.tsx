import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { requireCoach } from "@/features/access";
import { getScene, isValidSceneId } from "@/features/tactics";
import {
  ExecutionPicker,
  ExecutionPickerFilter,
  executionsContent,
  listExecutionCandidates,
  listExecutionGames,
  listLinkedTagIds,
  parsePickerFilter,
  toPickerRows,
} from "@/features/tactics/executions";

const { picker } = executionsContent;

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: picker.title,
  robots: { index: false, follow: false },
};

/**
 * Link tagged moments to a scene as its executions (plan vs reality): the
 * tags of one type - short corners unless the coach picks another - in one
 * game or all of them, filtered by the URL, ticked and linked in one go. An
 * unknown or malformed scene id is a 404.
 */
export default async function LinkExecutionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requireCoach(`/tactics/${id}/executions/link`);
  if (!isValidSceneId(id)) notFound();

  const filter = parsePickerFilter(await searchParams);
  const [scene, games, candidates, linked] = await Promise.all([
    getScene(id),
    listExecutionGames(),
    listExecutionCandidates(filter),
    listLinkedTagIds(id),
  ]);
  if (!scene) notFound();

  return (
    <PageContainer>
      <PageHeader
        back={{ href: `/tactics/${scene.id}`, label: picker.back }}
        title={picker.title}
        subtitle={`${scene.name} - ${picker.description}`}
      />
      <ExecutionPickerFilter sceneId={scene.id} filter={filter} games={games} />
      <ExecutionPicker
        // A new filter lists other moments, so nothing stays ticked.
        key={`${filter.type}/${filter.gameId}`}
        sceneId={scene.id}
        rows={toPickerRows(candidates, linked)}
      />
    </PageContainer>
  );
}
