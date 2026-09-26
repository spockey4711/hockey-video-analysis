/**
 * `GET /api/app/v1/players` - the roster for the Mac app (ADR 0013, Mac plan
 * S3): every player with its version, and the roster revision. Never a share
 * token: a player's link is fetched on demand and never stored on the Mac.
 */
import { getRoster } from "@/features/app-api/queries";
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
    return appJson(await getRoster(), 200);
  } catch (cause) {
    console.error("failed to read the roster", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
