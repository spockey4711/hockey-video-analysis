import type { Metadata } from "next";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { requireCoach } from "@/features/access";
import {
  CreateFormationForm,
  CreateSceneForm,
  FormationsList,
  SceneFilterForm,
  ScenesList,
  collectSceneTags,
  filterScenes,
  isSceneFilterSet,
  listFormations,
  listScenes,
  parseSceneFilter,
  sceneFilterQuery,
  tacticsContent,
} from "@/features/tactics";

const { list, formations: formationCopy } = tacticsContent;

// Coach-only workspace; keep it out of search indexes.
export const metadata: Metadata = {
  title: list.title,
  robots: { index: false, follow: false },
};

/**
 * The tactics board's scene list: every saved scene with a control to create
 * the next one, each linking to its board (ADR 0010), filtered by the URL's
 * category, view, tag and search (the set-play library), and below it the
 * coach's formations a new scene can start from.
 */
export default async function TacticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = parseSceneFilter(await searchParams);
  await requireCoach(`/tactics${sceneFilterQuery(filter)}`);
  const [scenes, formations] = await Promise.all([
    listScenes(),
    listFormations(),
  ]);
  const shown = filterScenes(scenes, filter);

  return (
    <PageContainer>
      <PageHeader title={list.title} subtitle={list.description} />
      <Card className="p-[var(--space-4)]">
        <CreateSceneForm formations={formations} />
      </Card>
      {scenes.length > 0 && (
        <SceneFilterForm
          filter={filter}
          tags={collectSceneTags(scenes)}
          shown={shown.length}
          total={scenes.length}
        />
      )}
      <ScenesList scenes={shown} filtered={isSceneFilterSet(filter)} />
      <section
        aria-labelledby="formations-heading"
        className="flex flex-col gap-[var(--space-4)] pt-[var(--space-4)]"
      >
        <div className="flex flex-col gap-[var(--space-1)]">
          <Heading level={2} id="formations-heading">
            {formationCopy.title}
          </Heading>
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {formationCopy.description}
          </p>
        </div>
        <Card className="p-[var(--space-4)]">
          <CreateFormationForm />
        </Card>
        <FormationsList formations={formations} />
      </section>
    </PageContainer>
  );
}
