import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { boardHref, type BoardFilters } from "@/lib/programs/filters";

type PaginationProps = { filters: BoardFilters; page: number; pageCount: number };

export function Pagination({ filters, page, pageCount }: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={boardHref(filters, { page: page - 1 })} className={linkClass} rel="prev">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-muted-foreground text-sm">
        Page {Math.min(page, pageCount)} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={boardHref(filters, { page: page + 1 })} className={linkClass} rel="next">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
