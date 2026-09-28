"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SORT_LABELS,
  SORT_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  boardHref,
  parseBoardFilters,
  type BoardFilters as Filters,
} from "@/lib/programs/filters";
import { programTypeLabel } from "@/lib/programs/types";

const SELECT_CLASS =
  "border-input bg-background h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type BoardFiltersProps = { filters: Filters };

function readForm(form: HTMLFormElement): Filters {
  const data = new FormData(form);
  return parseBoardFilters({
    q: String(data.get("q") ?? ""),
    status: String(data.get("status") ?? ""),
    sort: String(data.get("sort") ?? ""),
    view: String(data.get("view") ?? ""),
    type: data.getAll("type").map(String),
  });
}

/**
 * A plain GET form (works without JavaScript). With JavaScript, changes apply
 * immediately via client navigation and the URL omits default values.
 */
export function BoardFilters({ filters }: BoardFiltersProps) {
  const router = useRouter();

  function apply(form: HTMLFormElement) {
    // Any filter change starts again from page 1.
    router.push(boardHref(readForm(form), { page: 1 }), { scroll: false });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(event.currentTarget);
  }

  function handleChange(event: ChangeEvent<HTMLFormElement>) {
    // Search applies on submit (Enter); selects and checkboxes apply at once.
    if (event.target instanceof HTMLInputElement && event.target.type === "search") {
      return;
    }
    apply(event.currentTarget);
  }

  return (
    <form
      method="get"
      action="/"
      role="search"
      aria-label="Filter programs"
      onSubmit={handleSubmit}
      onChange={handleChange}
      // Re-mount when the URL changes (e.g. "Clear filters") so fields match it.
      key={boardHref(filters, { page: 1 })}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      {filters.view !== "cards" && <input type="hidden" name="view" value={filters.view} />}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Program or organization"
            defaultValue={filters.q}
            maxLength={100}
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={filters.status} className={SELECT_CLASS}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Type</legend>
          <div className="flex flex-wrap gap-3">
            {TYPE_OPTIONS.map((type) => (
              <label key={type} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="type"
                  value={type}
                  defaultChecked={filters.types.includes(type)}
                  className="size-4"
                />
                {programTypeLabel[type]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sort">Sort</Label>
          <select id="sort" name="sort" defaultValue={filters.sort} className={SELECT_CLASS}>
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}
