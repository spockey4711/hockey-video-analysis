import { ConfirmedActionForm } from "./ConfirmedActionForm";
import { deleteCollectionAction } from "./actions";
import { collectionsContent } from "./content";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";

const { detail } = collectionsContent.coach;

/**
 * The trailing danger section of a collection's detail page: deleting the
 * collection, with its own hint and a confirm step, kept apart from the
 * share-link panel so the coach never reaches for it while resetting the link.
 * A successful delete redirects to the collections list.
 */
export function CollectionDangerZone({
  collectionId,
}: {
  readonly collectionId: string;
}) {
  return (
    <Card
      as="section"
      aria-label={detail.delete.title}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={detail.delete.title}
        hint={detail.delete.description}
      />
      <ConfirmedActionForm
        collectionId={collectionId}
        action={deleteCollectionAction}
        copy={detail.delete}
        icon="trash-2"
        confirmVariant="danger"
      />
    </Card>
  );
}
