import Link from "next/link";

type BoardEmptyStateProps = {
  /** Shown when filters (or the default "open & upcoming" view) hide everything. */
  clearHref?: string;
  showAllHref?: string;
};

export function BoardEmptyState({ clearHref, showAllHref }: BoardEmptyStateProps = {}) {
  const filtered = clearHref !== undefined;
  return (
    <section
      aria-labelledby="board-empty-title"
      className="rounded-lg border border-dashed p-8 text-center"
    >
      <h2 id="board-empty-title" className="text-lg font-semibold">
        {filtered ? "No programs match these filters" : "No open programs right now"}
      </h2>
      <p className="text-muted-foreground mt-1">
        {filtered ? (
          <Link href={clearHref} className="underline underline-offset-4">
            Clear filters
          </Link>
        ) : showAllHref !== undefined ? (
          <>
            <Link href={showAllHref} className="underline underline-offset-4">
              Show closed programs too
            </Link>
            , or be the first to share an opportunity.
          </>
        ) : (
          "Be the first to share an opportunity."
        )}
      </p>
    </section>
  );
}

export function BoardErrorState() {
  return (
    <section
      role="alert"
      aria-labelledby="board-error-title"
      className="border-destructive/30 bg-destructive/5 rounded-lg border p-8 text-center"
    >
      <h2 id="board-error-title" className="text-lg font-semibold">
        We couldn&apos;t load the board
      </h2>
      <p className="text-muted-foreground mt-1">
        Please{" "}
        <Link href="/" className="underline underline-offset-4">
          try again
        </Link>{" "}
        in a moment.
      </p>
    </section>
  );
}
