/**
 * `PUT` and `DELETE /api/tags/[id]/scenes/[sceneId]` - link a tag to a
 * tactics scene as one of its executions, or unlink it (plan vs reality),
 * from the watch page's tag detail. A new link starts with the outcome the
 * game's goal tags make unambiguous, else open; linking again keeps the
 * link and its outcome. Both answer with the tag's scenes as `GET
 * /api/tags/[id]/scenes` lists them, so the panel shows the new state.
 *
 * Coach-only. A malformed id is a 400; an unknown tag or scene a 404.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import {
  linkExecutions,
  listTagSceneChoices,
  unlinkExecution,
} from "@/features/tactics/executions/queries";
import { isValidSceneId } from "@/features/tactics/validation";

type Context = { params: Promise<{ id: string; sceneId: string }> };

/** Check the session and both ids, answering the failure when one is off. */
async function readIds(
  context: Context,
): Promise<{ tagId: string; sceneId: string } | Response> {
  if (!(await getCurrentCoach())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, sceneId } = await context.params;
  if (!isValidSceneId(id) || !isValidSceneId(sceneId)) {
    return NextResponse.json(
      { error: "ids must be a valid tag and scene id" },
      { status: 400 },
    );
  }
  return { tagId: id, sceneId };
}

/** Answer with the tag's scenes after a change, and refresh the scene's pages. */
async function answer(tagId: string, sceneId: string): Promise<Response> {
  revalidatePath("/tactics");
  revalidatePath(`/tactics/${sceneId}`);
  revalidatePath(`/tactics/${sceneId}/executions`);
  const scenes = await listTagSceneChoices(tagId);
  if (!scenes) {
    return NextResponse.json({ error: "tag not found" }, { status: 404 });
  }
  return NextResponse.json({ scenes });
}

export async function PUT(
  _request: Request,
  context: Context,
): Promise<Response> {
  const ids = await readIds(context);
  if (ids instanceof Response) return ids;
  const added = await linkExecutions(ids.sceneId, [ids.tagId]);
  if (added === null) {
    return NextResponse.json({ error: "scene not found" }, { status: 404 });
  }
  return answer(ids.tagId, ids.sceneId);
}

export async function DELETE(
  _request: Request,
  context: Context,
): Promise<Response> {
  const ids = await readIds(context);
  if (ids instanceof Response) return ids;
  await unlinkExecution(ids.sceneId, ids.tagId);
  return answer(ids.tagId, ids.sceneId);
}
