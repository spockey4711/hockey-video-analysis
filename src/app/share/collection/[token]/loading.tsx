import { ShareLoading, ShareShell } from "@/features/share/shell";

/**
 * Route-level fallback while a collection's clips load. Renders the same nav-free
 * {@link ShareShell} frame as the page so the surface does not jump between the
 * loading and loaded states. The collection name is only known after the token
 * resolves, so the frame stays untitled here.
 */
export default function CollectionShareLoading() {
  return (
    <ShareShell>
      <ShareLoading />
    </ShareShell>
  );
}
