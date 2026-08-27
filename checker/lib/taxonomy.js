/**
 * Canonical tag taxonomy loader.
 *
 * The valid set of `category>value` tags is published by the tutorials-ims build
 * at hugo/data/tags.json (shape: { tags: ["category>value", ...], buildAt, error }).
 *
 * loadTaxonomy() fetches it ONCE per process (cached) and returns a Set of valid
 * tag strings, or null. It is FAIL-OPEN by design: any failure — network error,
 * non-200 response, unparseable/empty body, a non-null `error` field, or an empty
 * `tags` array — resolves to null. The unknown-tag rule treats null as "skip the
 * check entirely", so the checker is a silent no-op until the feed exists.
 *
 * Tags are lowercase-canonical (e.g. "software-product>sap-hana"); matching against
 * this set is case-sensitive to mirror the taxonomy's own casing.
 */

export const TAXONOMY_URL =
  "https://raw.githubusercontent.com/sap-tutorials/tutorials-ims/DEV/hugo/data/tags.json";

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
export async function loadTaxonomy({ fetchImpl, url = TAXONOMY_URL } = {}) {
  if (_cache !== undefined) return _cache;
  _cache = await fetchTaxonomy(fetchImpl ?? globalThis.fetch, url);
  return _cache;
}

/** Test hook: clear the module-level cache so the next loadTaxonomy() refetches. */
export function _resetTaxonomyCacheForTests() {
  _cache = undefined;
}
