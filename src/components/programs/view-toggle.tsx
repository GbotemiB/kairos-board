import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { boardHref, type BoardFilters, type ViewOption } from "@/lib/programs/filters";

const VIEWS: Array<{ view: ViewOption; label: string; Icon: typeof List }> = [
  { view: "cards", label: "Cards", Icon: LayoutGrid },
  { view: "list", label: "List", Icon: List },
];

export function ViewToggle({ filters }: { filters: BoardFilters }) {
  return (
    <nav aria-label="View" className="flex rounded-lg border p-0.5">
      {VIEWS.map(({ view, label, Icon }) => {
        const active = filters.view === view;
        return (
          <Link
            key={view}
            href={boardHref(filters, { view })}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm",
              active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
