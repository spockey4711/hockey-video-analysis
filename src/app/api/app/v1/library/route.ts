/**
 * `GET /api/app/v1/library` - the Mac app's pull (ADR 0013, Mac plan S3):
 * every game, collection and tactics scene with its revision, and the roster
 * revision. The Mac fetches the snapshot of each one whose revision moved; an
 * aggregate that is gone simply drops out of the list.
 */
import { getLibrary } from "@/features/app-api/queries";
import {
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
import { getApiSession } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;
  if (!(await getApiSession(request))) return appUnauthorized();

  try {
    return appJson(await getLibrary(), 200);
  } catch (cause) {
    console.error("failed to read the library", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
