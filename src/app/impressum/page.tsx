import type { Metadata } from "next";
import { connection } from "next/server";

import { Impressum, legalContent } from "@/features/legal";
import { getLegalOperator } from "@/features/legal/operator";

export const metadata: Metadata = {
  title: `${legalContent.impressum.title} - Hockey Video Analysis`,
};

/**
 * The Impressum. Public (no login) and linked from every page's footer. The
 * operator details are read from the environment at request time, never
 * hard-coded, because this repository is public.
 */
export default async function ImpressumPage() {
  // Read the env per request so a self-hosted deploy needs no rebuild.
  await connection();
  return <Impressum operator={getLegalOperator()} />;
}
