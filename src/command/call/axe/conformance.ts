/*
 * conformance.ts
 *
 * Conformance and severity labelling for scanned axe violations: the WCAG label
 * a finding carries, and the two ranks the report sorts on.
 *
 * These mirror `axeConformanceLevel`, `impactRank` and `standardRank` in
 * src/resources/formats/html/axe/axe-check.js, so a finding reads identically
 * whether it came from a scan or from the in-page report the render-time `axe:`
 * option produces.
 *
 * Mirrored rather than imported, for now.
 *
 * Importing `axe-check.js` itself was tried and reverted: it is a browser
 * module, so the whole overlay — reveal navigation, the dashboard rescan, the
 * report DOM — is inlined into the CLI bundle for the sake of three pure
 * functions, and its page globals (`Reveal`, `bootstrap`, `getComputedStyle`)
 * turn up as errors in `quarto-bld validate-bundle`'s no-undef analysis.
 * Whitelisting those would blunt a check that exists to catch real bundler bugs.
 *
 * A shared module *would* work, and is the better end state: `axe-check.js` is
 * injected with `type="module"` (src/format/html/format-html-axe.ts), and a
 * `FormatDependency`'s `resources` are copied into the same output directory as
 * its `scripts`, so both sides could import one pure `axe-conformance.js`. It
 * is deferred because it changes production resource code — the render path
 * every `axe:` user hits, plus a runtime 404 risk if the resource ever fails to
 * copy — for the benefit of a hidden prototype whose semantics are still in
 * play. That trade is worth making when `quarto axe` becomes a public command,
 * not before.
 *
 * Until then the duplication is pinned rather than trusted:
 * tests/unit/axe-conformance-parity.test.ts asserts these agree with
 * `axe-check.js` across the tag shapes axe emits. Tests are not bundled, so the
 * comparison is free there. Change one side and that test fails.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

interface ConformanceTags {
  bestPractice?: boolean;
  major?: string;
  minor?: string;
  /** the raw "a" / "aa" / "aaa" string */
  level?: string;
  obsolete?: boolean;
}

/**
 * Parse the conformance-related tags from axe's `tags` array. Tags encode the
 * version+level (`wcag2a`, `wcag21aa`) and `best-practice` for axe's own
 * recommendations, which aren't tied to a success criterion. An `-obsolete`
 * suffix marks a criterion withdrawn from a later WCAG version.
 */
function parseConformanceTags(tags: string[]): ConformanceTags | null {
  if (tags.includes("best-practice")) {
    return { bestPractice: true };
  }
  const versionTag = tags.find((tag) => /^wcag\d+a+(-obsolete)?$/.test(tag));
  if (!versionTag) {
    return null;
  }
  const match = versionTag.match(/^wcag(\d)(\d?)(a+)(-obsolete)?$/)!;
  return {
    major: match[1],
    minor: match[2],
    level: match[3],
    obsolete: !!match[4],
  };
}

/**
 * A human-readable WCAG conformance label including the success criteria
 * (`wcag111` → 1.1.1). Returns "" when there are no conformance tags, so
 * callers can fall back to the impact alone rather than print a level-less
 * criterion.
 */
export function axeConformanceLevel(tags: string[]): string {
  const parsed = parseConformanceTags(tags);
  if (!parsed) {
    return "";
  }
  if (parsed.bestPractice) {
    return "Best Practice";
  }

  let label = `WCAG ${parsed.major}.${parsed.minor || "0"} ${
    parsed.level!.toUpperCase()
  }`;

  // Principle and guideline are always single digits; the rest is the criterion.
  const criteria = tags
    .filter((tag) => /^wcag\d{3,}$/.test(tag))
    .map((tag) => {
      const digits = tag.slice(4);
      return `${digits[0]}.${digits[1]}.${digits.slice(2)}`;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (criteria.length) {
    label += ` (${criteria.join(", ")})`;
  }
  // An obsolete criterion's original level is still worth showing, flagged so
  // it isn't mistaken for a current conformance failure.
  return parsed.obsolete ? `Obsolete ${label}` : label;
}

/** Ascending: critical 0, serious 1, moderate 2, minor 3, unknown last. */
export function impactRank(impact?: string | null): number {
  return { critical: 0, serious: 1, moderate: 2, minor: 3 }[impact ?? ""] ?? 4;
}

/**
 * Ascending: WCAG A 0, AA 1, AAA 2, best-practice 3, obsolete 4, untagged 5.
 * A current WCAG requirement outranks a recommendation or a withdrawn criterion.
 */
export function standardRank(tags: string[]): number {
  const parsed = parseConformanceTags(tags);
  if (!parsed) {
    return 5;
  }
  if (parsed.bestPractice) {
    return 3;
  }
  if (parsed.obsolete) {
    return 4;
  }
  return parsed.level!.length - 1;
}
