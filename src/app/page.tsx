import { connection } from "next/server";

import { BoardEmptyState, BoardErrorState } from "@/components/programs/board-states";
import { ProgramGrid } from "@/components/programs/program-grid";
import { getBoardPrograms } from "@/lib/programs/queries";
import { siteConfig } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export default async function Home() {
  // Render per request so deadline countdowns are always current.
  await connection();

  const result = await getBoardPrograms(createPublicClient());
  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{siteConfig.tagline}</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">{siteConfig.description}</p>
      </section>

      {!result.ok ? (
        <BoardErrorState />
      ) : result.programs.length === 0 ? (
        <BoardEmptyState />
      ) : (
        <section aria-labelledby="board-title" className="flex flex-col gap-4">
          <h2 id="board-title" className="text-muted-foreground text-sm">
            {result.programs.length} {result.programs.length === 1 ? "program" : "programs"}
          </h2>
          <ProgramGrid programs={result.programs} now={now} />
        </section>
      )}
    </div>
  );
}
