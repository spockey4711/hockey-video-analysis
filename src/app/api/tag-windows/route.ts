/**
 * `GET /api/tag-windows` - the team's effective clip window per tag type
 * (Einstellungen > Tag-Fenster), for a client that captures on its own: the Mac
 * app reads it and keeps the last answer for offline tagging. Coach-only, like
 * the rest of the team workspace. The shape is documented in
 * `contracts/README.md`.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { tagWindowsPayload } from "@/features/tag-windows/payload";
import { getTagWindows } from "@/features/tag-windows/queries";

export async function GET(): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const windows = await getTagWindows();
  return NextResponse.json(tagWindowsPayload(windows), {
    headers: { "cache-control": "no-store" },
  });
}
