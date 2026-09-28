import Link from "next/link";
import { connection } from "next/server";

import { BoardFilters } from "@/components/programs/board-filters";
import { BoardEmptyState, BoardErrorState } from "@/components/programs/board-states";
import { Pagination } from "@/components/programs/pagination";
import { ProgramGrid } from "@/components/programs/program-grid";
import { ProgramList } from "@/components/programs/program-list";
import { ViewToggle } from "@/components/programs/view-toggle";
import {
  DEFAULT_FILTERS,
  boardHref,
  hasActiveFilters,
  parseBoardFilters,
} from "@/lib/programs/filters";
import { getBoardPrograms } from "@/lib/programs/queries";
import { siteConfig } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export default async function Home({ searchParams }: PageProps<"/">) {
  // Render per request so deadline countdowns are always current.
  await connection();

  const params = await searchParams;
  const justAdded = params.added === "1";
  const filters = parseBoardFilters(params);
  const result = await getBoardPrograms(createPublicClient(), filters);
  const now = new Date();

  const filtered = hasActiveFilters(filters);
  const clearHref = boardHref(DEFAULT_FILTERS, { view: filters.view });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{siteConfig.tagline}</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">{siteConfig.description}</p>
      </section>

      {justAdded && (
        <p
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950"
        >
          Thanks! Your program is now on the board.
        </p>
      )}

      <BoardFilters filters={filters} />

      {!result.ok ? (
        <BoardErrorState />
      ) : (
        <section aria-labelledby="board-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 id="board-title" className="text-muted-foreground text-sm" aria-live="polite">
                {result.total} {result.total === 1 ? "program" : "programs"}
              </h2>
              {filtered && (
                <Link href={clearHref} className="text-sm underline underline-offset-4">
                  Clear filters
                </Link>
              )}
            </div>
            <ViewToggle filters={filters} />
          </div>

          {result.total === 0 ? (
            <BoardEmptyState
              clearHref={filtered ? clearHref : undefined}
              showAllHref={filtered ? undefined : boardHref(filters, { status: "all" })}
            />
          ) : result.programs.length === 0 ? (
            <p className="text-muted-foreground text-center">
              There are no programs on this page.{" "}
              <Link href={boardHref(filters, { page: 1 })} className="underline underline-offset-4">
                Go to the first page
              </Link>
            </p>
          ) : filters.view === "list" ? (
            <ProgramList programs={result.programs} now={now} />
          ) : (
            <ProgramGrid programs={result.programs} now={now} />
          )}

          <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
        </section>
      )}
    </div>
  );
}
