import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateProgram } from "@/app/my/actions";
import { ProgramForm } from "@/components/submit/program-form";
import { requireUser } from "@/lib/auth/session";
import { getOwnProgram, recordToFormValues } from "@/lib/programs/mine";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit program" };

export default async function EditProgramPage({ params }: PageProps<"/my/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/my/${id}/edit`);

  const program = await getOwnProgram(await createServerSupabase(), user.id, id);
  if (program === null) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/my"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          ← My submissions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit program</h1>
      </div>
      <ProgramForm
        initialValues={recordToFormValues(program)}
        action={updateProgram.bind(null, program.id)}
        submitLabel="Save changes"
      />
    </div>
  );
}
