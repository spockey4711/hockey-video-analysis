/**
 * `GET /api/tags/[id]/scenes` - the tactics scenes a tag can be linked to as
 * an execution (plan vs reality), for the watch page's "Mit Szene
 * verknüpfen": every scene by name with how the tag's link to it stands.
 * Only names and outcomes; no scene document leaves here. Linking and
 * unlinking one scene is `PUT`/`DELETE /api/tags/[id]/scenes/[sceneId]`.
 *
 * Coach-only, like the rest of the tactics board. A malformed id is a 400 and
 * an unknown tag a 404.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { listTagSceneChoices } from "@/features/tactics/executions/queries";
import { isValidSceneId } from "@/features/tactics/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  if (!(await getCurrentCoach())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidSceneId(id)) {
    return NextResponse.json(
      { error: "id must be a valid tag id" },
      { status: 400 },
    );
  }
  const scenes = await listTagSceneChoices(id);
  if (!scenes) {
    return NextResponse.json({ error: "tag not found" }, { status: 404 });
  }
  return NextResponse.json({ scenes });
}
