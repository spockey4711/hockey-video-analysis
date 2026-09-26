/**
 * `DELETE /api/clips/[id]/comments/[commentId]` - remove one comment from a clip.
 * Moderation is coach-only: a signed-in coach deletes a rude or mistaken
 * comment, and it is gone from every link on the next load. Unlike reading and
 * posting (`../route.ts`), a share token never authorizes this route: without a
 * coach session the answer is 401 even when a `?shareToken=` is sent. The
 * comment is hard-deleted - nothing references a comment row, so there is no
 * history to keep.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { deleteCommentFromClip } from "@/features/clips/comments";
import { isUuid } from "@/features/clips/validation";

type Context = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, commentId } = await params;
  if (!isUuid(id) || !isUuid(commentId)) {
    return NextResponse.json(
      { error: "id and commentId must be valid ids" },
      { status: 400 },
    );
  }

  if (!(await deleteCommentFromClip(id, commentId))) {
    return NextResponse.json({ error: "comment not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
