/** Query parameters that only track where a click came from. */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
]);
const TRACKING_PREFIXES = ["utm_"];

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return TRACKING_PARAMS.has(lower) || TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Canonical form used as the duplicate-detection key (`programs.url_normalized`).
 * Not a fetch target: http and https collapse to https.
 */
export function normalizeUrl(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  const params = [...url.searchParams.entries()]
    .filter(([name]) => !isTrackingParam(name))
    .sort(([aName, aValue], [bName, bValue]) =>
      aName === bName ? aValue.localeCompare(bValue) : aName.localeCompare(bName),
    );
  const search = new URLSearchParams(params).toString();

  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

  return `https://${host}${path}${search === "" ? "" : `?${search}`}`;
}
