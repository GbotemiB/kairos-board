import type { Metadata } from "next";

import { SubmitFlow } from "@/components/submit/submit-flow";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add a program" };

export default async function SubmitPage() {
  await requireUser("/submit");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add a program</h1>
        <p className="text-muted-foreground">
          Paste a link to an internship, fellowship or program. We&apos;ll read the page and fill in
          the details for you to check.
        </p>
      </div>
      <SubmitFlow />
    </div>
  );
}
