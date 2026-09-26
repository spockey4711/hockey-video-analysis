/**
 * The Mac app's sign-in (ADR 0013, Mac plan S2).
 *
 * `POST /api/app/v1/sessions` checks the coach's email and password exactly as
 * the web login does (same scrypt check, same rate-limit bucket) and answers a
 * bearer token for a new device session. Only the token's hash is stored; the
 * raw token exists in this one response and is never logged.
 *
 * `DELETE /api/app/v1/sessions` signs the calling device out. Removing the Mac
 * under Einstellungen > Geräte does the same from the browser.
 */
import { checkCredentials, clientIp } from "@/features/access/sign-in";
import {
  appEmpty,
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
import { parseDeviceSignIn } from "@/features/app-api/validation";
import { createSession, getApiSession, revokeSession } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return appJson({ error: "invalid JSON body" }, 400);
  }

  const parsed = parseDeviceSignIn(raw);
  if (!parsed.ok) return appJson({ error: parsed.error }, 400);
  const { email, password, deviceName } = parsed.value;

  try {
    const check = await checkCredentials(
      email,
      password,
      clientIp(request.headers),
    );
    if (!check.ok) {
      if (check.reason === "limited") {
        const retryAfterS = Math.max(1, Math.ceil(check.retryAfterMs / 1000));
        return appJson({ error: "too many attempts" }, 429, {
          "Retry-After": String(retryAfterS),
        });
      }
      return appJson({ error: "invalid credentials" }, 401);
    }

    const { token } = await createSession(check.coachId, {
      kind: "device",
      deviceName,
    });
    return appJson({ token }, 201);
  } catch (cause) {
    console.error("failed to start a device session", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;

  try {
    const session = await getApiSession(request);
    // Only a device signs itself out here; a browser uses the logout form.
    if (!session || session.kind !== "device") return appUnauthorized();
    await revokeSession(session.coach.id, session.publicId);
    return appEmpty(204);
  } catch (cause) {
    console.error("failed to end a device session", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
