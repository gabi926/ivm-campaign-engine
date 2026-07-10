// D2 — AL Audience Builder entry page (server component).
//
// Auth is already enforced at the layout level via requireAuth(); the shell
// component owns the form + result flow. Extending this page in Phase 4:
// - /audiences/history for the paged list
// - /audiences/[id] for saved-spec detail (reuses AudienceSpecView)

import type { Metadata } from "next";
import { AudienceBuilderClient } from "./AudienceBuilderClient";

export const metadata: Metadata = {
  title: "Audience Builder — Revenue Engine",
  description:
    "Generate an Audience Labs audience spec from an ICP brief. Server-side taxonomy ranker + Claude Sonnet 4.6.",
};

export const dynamic = "force-dynamic";

export default function AudiencesPage() {
  return (
    <main className="grain flex-1">
      <div className="px-5 py-8 md:px-8 md:py-12">
        <AudienceBuilderClient />
      </div>
    </main>
  );
}
