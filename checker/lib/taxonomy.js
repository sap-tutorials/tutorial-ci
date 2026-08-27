/**
 * Canonical tag taxonomy loader.
 *
 * The valid set of `category>value` tags is served live by the tutorials-ims CAP
 * backend at the PROD `/build/tags` feed (shape: { tags: ["category>value", ...],
 * buildAt, error }). PROD srv is public/anonymous, so no auth is needed. This
 * reflects the current PROD taxonomy (~10K tags) — the full canonical set, not a
 * subset — and never goes stale, unlike a committed data file.
 *
 * The URL defaults to the PROD feed and is overridable via the TUTORIAL_TAGS_FEED_URL
 * env var (no code change needed to repoint it).
 *
 * loadTaxonomy() fetches it ONCE per process (cached) and returns a Set of valid
 * tag strings, or null. It is FAIL-OPEN by design: any failure — network error,
 * non-200 response, unparseable/empty body, a non-null `error` field, or an empty
 * `tags` array — resolves to null. The unknown-tag rule treats null as "skip the
 * check entirely". `/build/tags` currently 404s in PROD (the feed has not been
 * PROD-deployed yet), so the checker stays a silent no-op until that deploy lands.
 *
 * Tags are lowercase-canonical (e.g. "software-product>sap-hana"); matching against
 * this set is case-sensitive to mirror the taxonomy's own casing.
 */

export const TAXONOMY_URL =
  "https://tutorial-system-prod-tutorials-srv.cfapps.eu10-005.hana.ondemand.com/build/tags";

/** Resolve the feed URL: TUTORIAL_TAGS_FEED_URL env override, else the PROD default. */
export function resolveTaxonomyUrl() {
  return process.env.TUTORIAL_TAGS_FEED_URL || TAXONOMY_URL;
}

// undefined = not yet loaded; Set = valid tags; null = unavailable (fail-open)
let _cache;

async function fetchTaxonomy(fetchImpl, url) {
  if (typeof fetchImpl !== "function") return null;
  try {
    // Bounded so a hung/blocked connection can never stall the checker run.
    const signal =
      typeof AbortSignal !== "undefined" && AbortSignal.timeout
        ? AbortSignal.timeout(5000)
        : undefined;
    const res = await fetchImpl(url, signal ? { signal } : undefined);
    if (!res || !res.ok || res.status !== 200) return null;
    const json = await res.json();
    if (!json || json.error) return null;
    if (!Array.isArray(json.tags) || json.tags.length === 0) return null;
    const valid = json.tags.filter((t) => typeof t === "string" && t.length > 0);
    if (valid.length === 0) return null;
    return new Set(valid);
  } catch {
    return null;
  }
}

/**
 * @param {{ fetchImpl?: typeof fetch, url?: string }} [opts]
 * @returns {Promise<Set<string>|null>} valid tag set, or null when unavailable
 */
export async function loadTaxonomy({ fetchImpl, url = resolveTaxonomyUrl() } = {}) {
  if (_cache !== undefined) return _cache;
  _cache = await fetchTaxonomy(fetchImpl ?? globalThis.fetch, url);
  return _cache;
}

/** Test hook: clear the module-level cache so the next loadTaxonomy() refetches. */
export function _resetTaxonomyCacheForTests() {
  _cache = undefined;
}
