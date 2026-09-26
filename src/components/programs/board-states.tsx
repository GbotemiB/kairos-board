import Link from "next/link";

export function BoardEmptyState() {
  return (
    <section
      aria-labelledby="board-empty-title"
      className="rounded-lg border border-dashed p-8 text-center"
    >
      <h2 id="board-empty-title" className="text-lg font-semibold">
        No programs yet
      </h2>
      <p className="text-muted-foreground mt-1">
        Be the first to share an opportunity. Submissions open soon.
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
