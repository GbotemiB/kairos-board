import type { Metadata } from "next";
import Link from "next/link";

import { deleteProgram } from "@/app/my/actions";
import { DeleteProgramButton } from "@/components/my/delete-program-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/programs/deadline";
import { getMySubmissions } from "@/lib/programs/mine";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My submissions" };

const NOTICES: Record<string, string> = {
  updated: "Your changes are saved.",
  deleted: "The program was deleted.",
};

export default async function MySubmissionsPage({ searchParams }: PageProps<"/my">) {
  const user = await requireUser("/my");
  const params = await searchParams;
  const notice =
    params.updated === "1" ? NOTICES.updated : params.deleted === "1" ? NOTICES.deleted : null;

  const result = await getMySubmissions(await createServerSupabase(), user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">My submissions</h1>
          <p className="text-muted-foreground">Programs you&apos;ve added to the board.</p>
        </div>
        <Link href="/submit" className={buttonVariants({ size: "sm" })}>
          Add program
        </Link>
      </div>

      {notice !== null && (
        <p
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950"
        >
          {notice}
        </p>
      )}

      {!result.ok ? (
        <p role="alert" className="text-destructive">
          We couldn&apos;t load your submissions. Please try again.
        </p>
      ) : result.programs.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          You haven&apos;t added any programs yet.
        </p>
      ) : (
        <ul aria-label="Your programs" className="divide-y rounded-lg border">
          {result.programs.map((program) => (
            <li
              key={program.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{program.title}</span>
                  {program.is_hidden && <Badge variant="destructive">Hidden by a moderator</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">
                  Added {formatDate(new Date(program.created_at))}
                  {program.deadline !== null && <> · Deadline {program.deadline}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/my/${program.id}/edit`}
                  aria-label={`Edit ${program.title}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
                </Link>
                <DeleteProgramButton
                  title={program.title}
                  action={deleteProgram.bind(null, program.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
