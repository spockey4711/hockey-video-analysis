import type { Metadata } from "next";

import {
  AudienceView,
  presentationContent,
} from "@/features/share/presentation";
import { shareMetadata } from "@/features/share/shell";

/**
 * The audience window of a presentation on a second screen (ADR 0015): the
 * page the presenter opens on the projector. It is login-free like the share
 * links it comes from, but loads nothing on its own - no token, no clip, no
 * name. Everything it shows arrives from the presenter's window in this same
 * browser, over a channel named in the address's fragment, which never
 * reaches the server. Opened by hand, it says what it is for and shows
 * nothing else.
 */
export const metadata: Metadata = {
  ...shareMetadata,
  title: presentationContent.audience.title,
};

export default function PresentationAudiencePage() {
  return <AudienceView />;
}
