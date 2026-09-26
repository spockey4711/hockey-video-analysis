/**
 * `GET /api/tag-windows` - the team's effective clip window per tag type
 * (Einstellungen > Tag-Fenster), for a client that captures on its own: the Mac
 * app reads it with its bearer token and keeps the last answer for offline
 * tagging. Coach-only, like the rest of the team workspace. The shape is
 * documented in `contracts/README.md`.
 */
import { NextResponse } from "next/server";

import { tagWindowsPayload } from "@/features/tag-windows/payload";
import { getTagWindows } from "@/features/tag-windows/queries";
import { getApiSession } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
  if (!(await getApiSession(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const windows = await getTagWindows();
  return NextResponse.json(tagWindowsPayload(windows), {
    headers: { "cache-control": "no-store" },
  });
}
