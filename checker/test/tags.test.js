import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { tagRules } from "../rules/tags.js";
import { loadTaxonomy, _resetTaxonomyCacheForTests, TAXONOMY_URL, resolveTaxonomyUrl } from "../lib/taxonomy.js";

// Run only the tag rules with an injected taxonomy set (mirrors frontmatter.test.js,
// which threads an explicit rules array into runChecks).
const check = (md, taxonomy) =>
  runChecks(md, "tutorials/x/x.md", tagRules, { taxonomy });

const md = (tags, primary) =>
  `---\ntime: 5\nauthor_name: A\nauthor_profile: https://github.com/a\n` +
  `tags: [${tags.join(", ")}]\nprimary_tag: ${primary}\n---\n# X\n`;

const TAXO = new Set(["software-product>sap-hana", "topic>cloud"]);

test("a known-good tag produces no finding", () => {
  const doc = md(["software-product>sap-hana", "tutorial>beginner"], "software-product>sap-hana");
  expect(check(doc, TAXO).map((f) => f.rule)).not.toContain("frontmatter-unknown-tag");
});

test("an unknown tag in tags[] emits a notice naming the tag", () => {
  const doc = md(["software-product>bogus-product", "tutorial>beginner"], "software-product>sap-hana");
  const findings = check(doc, TAXO).filter((f) => f.rule === "frontmatter-unknown-tag");
  expect(findings.length).toBe(1);
  expect(findings[0].severity).toBe("notice");
  expect(findings[0].message).toMatch(/software-product>bogus-product/);
});

test("an unknown primary_tag emits a notice", () => {
  const doc = md(["software-product>sap-hana", "tutorial>beginner"], "software-product>nope");
  const rules = check(doc, TAXO).filter((f) => f.rule === "frontmatter-unknown-tag");
  expect(rules.map((f) => f.message).join(" ")).toMatch(/software-product>nope/);
});

test("the tutorial>level tag is skipped (owned by frontmatter-missing-level-tag)", () => {
  const doc = md(["software-product>sap-hana", "tutorial>advanced"], "software-product>sap-hana");
  // tutorial>advanced is NOT in TAXO but must not be flagged as unknown.
  expect(check(doc, TAXO).map((f) => f.message).join(" ")).not.toMatch(/tutorial>advanced/);
});

test("primary_tag duplicated in tags[] is reported once, not twice", () => {
  const doc = md(["software-product>dup", "tutorial>beginner"], "software-product>dup");
  const findings = check(doc, TAXO).filter((f) => f.rule === "frontmatter-unknown-tag");
  expect(findings.length).toBe(1);
});

test("FAIL-OPEN: null taxonomy (feed unavailable) emits nothing", () => {
  const doc = md(["software-product>bogus", "tutorial>beginner"], "software-product>bogus");
  expect(check(doc, null)).toEqual([]);
});

test("FAIL-OPEN: empty taxonomy set emits nothing", () => {
  const doc = md(["software-product>bogus", "tutorial>beginner"], "software-product>bogus");
  expect(check(doc, new Set())).toEqual([]);
});

test("FAIL-OPEN by default: allRules with no taxonomy threaded emits no unknown-tag notice", () => {
  const doc = md(["software-product>bogus", "tutorial>beginner"], "software-product>bogus");
  expect(runChecks(doc, "tutorials/x/x.md").map((f) => f.rule)).not.toContain("frontmatter-unknown-tag");
});

// ---- loadTaxonomy() fail-open unit tests (mocked fetch) ----

const okJson = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

test("loadTaxonomy returns a Set on a well-formed feed", async () => {
  _resetTaxonomyCacheForTests();
  const fetchImpl = async () => okJson({ tags: ["a>b", "c>d"], buildAt: "now", error: null });
  const taxo = await loadTaxonomy({ fetchImpl, url: "http://x" });
  expect(taxo).toBeInstanceOf(Set);
  expect(taxo.has("a>b")).toBe(true);
});

test("loadTaxonomy fails open (null) on non-200", async () => {
  _resetTaxonomyCacheForTests();
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  expect(await loadTaxonomy({ fetchImpl, url: "http://x" })).toBeNull();
});

test("loadTaxonomy fails open (null) when error field is set", async () => {
  _resetTaxonomyCacheForTests();
  const fetchImpl = async () => okJson({ tags: ["a>b"], error: "build failed" });
  expect(await loadTaxonomy({ fetchImpl, url: "http://x" })).toBeNull();
});

test("loadTaxonomy fails open (null) on empty tags array", async () => {
  _resetTaxonomyCacheForTests();
  const fetchImpl = async () => okJson({ tags: [], error: null });
  expect(await loadTaxonomy({ fetchImpl, url: "http://x" })).toBeNull();
});

test("loadTaxonomy fails open (null) when fetch throws", async () => {
  _resetTaxonomyCacheForTests();
  const fetchImpl = async () => {
    throw new Error("network down");
  };
  expect(await loadTaxonomy({ fetchImpl, url: "http://x" })).toBeNull();
});

// ---- feed URL source: PROD default + env-var override ----

test("TAXONOMY_URL defaults to the live PROD /build/tags feed", () => {
  expect(TAXONOMY_URL).toBe(
    "https://tutorial-system-prod-tutorials-srv.cfapps.eu10-005.hana.ondemand.com/build/tags"
  );
});

test("resolveTaxonomyUrl uses the PROD default when the env var is unset", () => {
  const prev = process.env.TUTORIAL_TAGS_FEED_URL;
  delete process.env.TUTORIAL_TAGS_FEED_URL;
  try {
    expect(resolveTaxonomyUrl()).toBe(TAXONOMY_URL);
  } finally {
    if (prev !== undefined) process.env.TUTORIAL_TAGS_FEED_URL = prev;
  }
});

test("TUTORIAL_TAGS_FEED_URL env var overrides the default feed URL", async () => {
  const prev = process.env.TUTORIAL_TAGS_FEED_URL;
  process.env.TUTORIAL_TAGS_FEED_URL = "http://override.example/build/tags";
  try {
    expect(resolveTaxonomyUrl()).toBe("http://override.example/build/tags");

    // loadTaxonomy() with no explicit url should fetch the overridden URL.
    _resetTaxonomyCacheForTests();
    let fetchedUrl;
    const fetchImpl = async (u) => {
      fetchedUrl = u;
      return okJson({ tags: ["a>b"], error: null });
    };
    const taxo = await loadTaxonomy({ fetchImpl });
    expect(fetchedUrl).toBe("http://override.example/build/tags");
    expect(taxo).toBeInstanceOf(Set);
  } finally {
    if (prev === undefined) delete process.env.TUTORIAL_TAGS_FEED_URL;
    else process.env.TUTORIAL_TAGS_FEED_URL = prev;
    _resetTaxonomyCacheForTests();
  }
});
