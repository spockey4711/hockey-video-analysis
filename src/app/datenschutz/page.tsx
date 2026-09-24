import type { Metadata } from "next";
import { connection } from "next/server";

import { PrivacyPolicy, legalContent } from "@/features/legal";
import { getLegalOperator } from "@/features/legal/operator";

export const metadata: Metadata = {
  title: `${legalContent.privacy.title} - Hockey Video Analysis`,
};

/**
 * The Datenschutzerklärung. Public (no login) and linked from every page's
 * footer. The controller's details and the optional hoster name are read from
 * the environment at request time; the policy text lives in the legal feature.
 */
export default async function DatenschutzPage() {
  // Read the env per request so a self-hosted deploy needs no rebuild.
  await connection();
  return <PrivacyPolicy operator={getLegalOperator()} />;
}
