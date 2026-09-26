"use client";

import { useRouter } from "next/navigation";

import {
  DeletableCommentCard,
  type DeletableCommentCardProps,
} from "@/features/clips/comments/DeletableCommentCard";

/**
 * A comment in the coach's collection insights with the delete control. The
 * insights render on the server, so a deleted comment is dropped by refreshing
 * the page's server data rather than by local state.
 */
export function InsightsCommentCard(
  props: Omit<DeletableCommentCardProps, "onDeleted">,
) {
  const router = useRouter();
  return <DeletableCommentCard {...props} onDeleted={() => router.refresh()} />;
}
