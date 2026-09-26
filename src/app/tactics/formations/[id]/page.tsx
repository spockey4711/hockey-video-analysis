import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Heading } from "@/components/core/Heading";
import { requireCoach } from "@/features/access";
import {
  FormationEditor,
  getFormation,
  isValidSceneId,
  tacticsContent,
} from "@/features/tactics";

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: tacticsContent.formations.title,
  robots: { index: false, follow: false },
};

/**
 * One formation on the board: place both teams and the ball at their start
 * positions, and save, rename, duplicate or delete it. An unknown or
 * malformed id is a 404.
 */
export default async function TacticsFormationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/tactics/formations/${id}`);
  if (!isValidSceneId(id)) notFound();

  const formation = await getFormation(id);
  if (!formation) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-6)] sm:px-[var(--space-6)] sm:py-[var(--space-8)]">
      <div>
        <Link
          href="/tactics"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] underline-offset-2 hover:underline"
        >
          {tacticsContent.formations.back}
        </Link>
      </div>
      <Heading level={1} className="break-words">
        {formation.name}
      </Heading>
      <FormationEditor
        formationId={formation.id}
        name={formation.name}
        kind={formation.kind}
        formation={formation.formation}
      />
    </main>
  );
}
