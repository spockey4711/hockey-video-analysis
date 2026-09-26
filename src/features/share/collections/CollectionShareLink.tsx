import { ConfirmedActionForm } from "./ConfirmedActionForm";
import { rotateCollectionTokenAction } from "./actions";
import { collectionsContent } from "./content";

import { Card } from "@/components/core/Card";
// Import the field directly (not the players barrel) so this surface never pulls
// the roster's server-only queries in through the barrel.
import { ShareLinkField } from "@/components/players/ShareLinkField";

const { detail } = collectionsContent.coach;

export interface CollectionShareLinkProps {
  readonly collectionId: string;
  /** Absolute share URL when the deploy URL is known, else the app-relative path. */
  readonly url: string;
  /** The always-valid app-relative path shown in the field. */
  readonly path: string;
}

/**
 * The share-link panel for a collection: the copyable secret link and the
 * confirm-gated rotate (revoke) control with its own hint. A rotation
 * revalidates the detail page, so the `url`/`path` this receives already
 * reflect the freshly issued token. Deleting the collection lives in its own
 * trailing danger section ({@link CollectionDangerZone}), not here.
 */
export function CollectionShareLink({
  collectionId,
  url,
  path,
}: CollectionShareLinkProps) {
  return (
    <Card
      as="section"
      aria-label={detail.shareLinkLabel}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]"
    >
      <ShareLinkField url={url} path={path} label={detail.shareLinkLabel} />

      <div className="border-t border-[color:var(--border-subtle)] pt-[var(--space-3)]">
        <ConfirmedActionForm
          collectionId={collectionId}
          action={rotateCollectionTokenAction}
          copy={detail.rotate}
          icon="rewind"
          hint={detail.rotate.description}
          confirmVariant="primary"
        />
      </div>
    </Card>
  );
}
