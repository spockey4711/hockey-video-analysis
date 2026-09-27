import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
import { requireCoach } from "@/features/access";
import { PlaylistPlayer } from "@/features/share/playlist";
import { getScene, isValidSceneId } from "@/features/tactics";
import {
  ExecutionSummary,
  executionStats,
  executionsContent,
  listSceneExecutions,
  toExecutionPlaylist,
} from "@/features/tactics/executions";

const { playlist } = executionsContent;

// Coach-only viewing surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: executionsContent.scene.watch,
  robots: { index: false, follow: false },
};

/**
 * A scene's executions one after another (plan vs reality): the ready clip
 * of every tagged moment linked to the scene, newest game first, on the same
 * clip player the share links use, each playing its tag window. Coach-only;
 * nothing here has a share link. An unknown or malformed id is a 404.
 */
export default async function SceneExecutionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/tactics/${id}/executions`);
  if (!isValidSceneId(id)) notFound();

  const [scene, executions] = await Promise.all([
    getScene(id),
    listSceneExecutions(id),
  ]);
  if (!scene) notFound();

  const items = toExecutionPlaylist(executions, process.env.MEDIA_BASE_URL);
  const missing = executions.length - items.length;

  return (
    <PageContainer>
      <PageHeader
        back={{ href: `/tactics/${scene.id}`, label: playlist.back }}
        title={playlist.title(scene.name)}
        subtitle={
          <ExecutionSummary
            stats={executionStats(executions.map((row) => row.outcome))}
          />
        }
      />
      {items.length > 0 ? (
        <PlaylistPlayer items={items} />
      ) : (
        <Card className="p-[var(--space-8)]">
          <EmptyState
            icon="film"
            title={playlist.empty.title}
            hint={playlist.empty.hint}
          />
        </Card>
      )}
      {items.length > 0 && missing > 0 && (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {playlist.missing(missing)}
        </p>
      )}
    </PageContainer>
  );
}
