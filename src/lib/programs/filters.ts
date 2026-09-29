import type { ProgramStatus, ProgramType } from "@/lib/programs/types";

export const STATUS_OPTIONS = ["open-upcoming", "open", "upcoming", "closed", "all"] as const;
export type StatusOption = (typeof STATUS_OPTIONS)[number];

export const SORT_OPTIONS = ["deadline", "newest"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const VIEW_OPTIONS = ["cards", "list"] as const;
export type ViewOption = (typeof VIEW_OPTIONS)[number];

export const TYPE_OPTIONS: readonly ProgramType[] = [
  "INTERNSHIP",
  "FELLOWSHIP",
  "PROGRAM",
  "OTHER",
];

export const PAGE_SIZE = 24;
export const MAX_QUERY_LENGTH = 100;

export type BoardFilters = {
  status: StatusOption;
  types: ProgramType[];
  q: string;
  sort: SortOption;
  view: ViewOption;
  page: number;
};

export const DEFAULT_FILTERS: BoardFilters = {
  status: "open-upcoming",
  types: [],
  q: "",
  sort: "deadline",
  view: "cards",
  page: 1,
};

export const STATUS_LABELS: Record<StatusOption, string> = {
  "open-upcoming": "Open & upcoming",
  open: "Open",
  upcoming: "Upcoming",
  closed: "Closed",
  all: "All",
};

export const SORT_LABELS: Record<SortOption, string> = {
  deadline: "Deadline soonest",
  newest: "Newest added",
};

/** Database statuses for a status option; null means no filter. */
export function statusesFor(option: StatusOption): ProgramStatus[] | null {
  switch (option) {
    case "open-upcoming":
      return ["OPEN", "UPCOMING"];
    case "open":
      return ["OPEN"];
    case "upcoming":
      return ["UPCOMING"];
    case "closed":
      return ["CLOSED"];
    case "all":
      return null;
  }
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function oneOf<T extends string>(value: string | undefined, options: readonly T[], fallback: T): T {
  return value !== undefined && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Reads filters from the URL. Unknown or malformed values fall back to the
 * defaults instead of erroring, so any shared link still renders a board.
 */
export function parseBoardFilters(params: RawParams): BoardFilters {
  const types = [
    ...new Set(
      all(params.type)
        .map((type) => type.toUpperCase())
        .filter((type): type is ProgramType => (TYPE_OPTIONS as readonly string[]).includes(type)),
    ),
  ];
  const page = Number.parseInt(first(params.page) ?? "", 10);

  return {
    status: oneOf(first(params.status), STATUS_OPTIONS, DEFAULT_FILTERS.status),
    // Keep a stable order so equivalent URLs look the same.
    types: TYPE_OPTIONS.filter((type) => types.includes(type)),
    q: (first(params.q) ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH),
    sort: oneOf(first(params.sort), SORT_OPTIONS, DEFAULT_FILTERS.sort),
    view: oneOf(first(params.view), VIEW_OPTIONS, DEFAULT_FILTERS.view),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

/** Serializes filters, omitting defaults so URLs stay short. */
export function toSearchParams(filters: BoardFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set("status", filters.status);
  for (const type of filters.types) params.append("type", type);
  if (filters.q !== "") params.set("q", filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.view !== DEFAULT_FILTERS.view) params.set("view", filters.view);
  if (filters.page !== 1) params.set("page", String(filters.page));
  return params;
}

export function boardHref(filters: BoardFilters, changes: Partial<BoardFilters> = {}): string {
  const query = toSearchParams({ ...filters, ...changes }).toString();
  return query === "" ? "/" : `/?${query}`;
}

/** True when the user has narrowed the board beyond the defaults (view and page aside). */
export function hasActiveFilters(filters: BoardFilters): boolean {
  return (
    filters.status !== DEFAULT_FILTERS.status ||
    filters.types.length > 0 ||
    filters.q !== "" ||
    filters.sort !== DEFAULT_FILTERS.sort
  );
}

/**
 * Makes search text safe inside a PostgREST `or=(...)` filter, where commas,
 * parentheses and quotes are syntax, and `%`, `_`, `*` are wildcards.
 */
export function toSearchPattern(q: string): string | null {
  const cleaned = q
    .replace(/[,()"'\\%_*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned === "" ? null : `%${cleaned}%`;
}
