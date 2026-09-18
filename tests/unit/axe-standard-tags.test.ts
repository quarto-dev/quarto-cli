/*
 * axe-standard-tags.test.ts
 *
 * Tests the axe.run scoping options derived from the `axe: standard` and
 * `axe: best-practice` document options
 * (https://github.com/quarto-dev/quarto-cli/issues/14607).
 *
 * These exercise our own tag mapping and option assembly, not axe-core's rule
 * data: rule catalogs are hand-written `{ruleId, tags}` objects (the contract
 * axe.getRules() hands us), so an axe-core upgrade that re-tags a rule cannot
 * break these tests.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  axeScopeOptions,
  STANDARD_TAGS,
} from "../../src/resources/formats/html/axe/axe-check.js";

// A miniature rule catalog covering the cases axeScopeOptions must
// distinguish: current rules at several levels, a deprecated rule that
// matches a selected wcag tag and is explicitly disabled by axeScopeOptions
// as a self-contained guard, a deprecated rule whose only wcag tag is
// obsolete, and a best-practice rule.
const rules = [
  { ruleId: "image-alt", tags: ["cat.text-alternatives", "wcag2a", "wcag111"] },
  { ruleId: "color-contrast", tags: ["cat.color", "wcag2aa", "wcag143"] },
  { ruleId: "target-size", tags: ["cat.sensory-and-visual-cues", "wcag22aa", "wcag258"] },
  { ruleId: "audio-caption", tags: ["cat.time-and-media", "wcag2a", "wcag121", "deprecated"] },
  { ruleId: "duplicate-id", tags: ["cat.parsing", "wcag2a-obsolete", "wcag411", "deprecated"] },
  { ruleId: "heading-order", tags: ["cat.semantics", "best-practice"] },
];

unitTest(
  "STANDARD_TAGS - defines the nine documented conformance levels",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(Object.keys(STANDARD_TAGS), [
      "wcag2a",
      "wcag2aa",
      "wcag2aaa",
      "wcag21a",
      "wcag21aa",
      "wcag21aaa",
      "wcag22a",
      "wcag22aa",
      "wcag22aaa",
    ]);
  },
);

unitTest(
  "STANDARD_TAGS - levels are cumulative across levels and versions",
  // deno-lint-ignore require-await
  async () => {
    // WCAG conformance logic: each standard covers its own tag, every lower
    // level of the same version, and everything the same level of the
    // previous version covers. The mapping is logically complete — it lists
    // tags even where the bundled axe-core currently has no rules (2.1 AAA,
    // 2.2 A, 2.2 AAA) — so the recurrence must hold with no gaps.
    const table = STANDARD_TAGS as Record<string, string[]>;
    const previousVersion: Record<string, string> = { "21": "2", "22": "21" };
    for (const [standard, tags] of Object.entries(table)) {
      const [, version, level] = standard.match(/^wcag(2\d?)(a+)$/)!;
      assertEquals(
        tags.includes(standard),
        true,
        `${standard} includes its own tag`,
      );
      for (let l = 1; l < level.length; l++) {
        const lower = `wcag${version}${"a".repeat(l)}`;
        for (const tag of table[lower]) {
          assertEquals(
            tags.includes(tag),
            true,
            `${standard} covers ${tag} (via ${lower})`,
          );
        }
      }
      if (previousVersion[version]) {
        const previous = `wcag${previousVersion[version]}${level}`;
        for (const tag of table[previous]) {
          assertEquals(
            tags.includes(tag),
            true,
            `${standard} covers ${tag} (via ${previous})`,
          );
        }
      }
      // A criterion introduced in a later version can never be required by an
      // earlier standard.
      if (version === "2") {
        assertEquals(
          tags.some((t) => /^wcag2\d/.test(t)),
          false,
          `${standard} has no 2.1/2.2 tags`,
        );
      }
    }
  },
);

unitTest(
  "axeScopeOptions - no standard, no best-practice: default scan untouched",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(axeScopeOptions({ output: "json" }, rules), {});
    assertEquals(
      axeScopeOptions({ output: "json", "best-practice": true }, rules),
      {},
    );
  },
);

unitTest(
  "axeScopeOptions - standard sets runOnly and disables matching deprecated rules",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(axeScopeOptions({ standard: "wcag2a" }, rules), {
      runOnly: { type: "tag", values: ["wcag2a"] },
      // audio-caption is deprecated but tagged wcag2a, so it matches the tag
      // list; axeScopeOptions disables it explicitly (axe's default tagExclude
      // already excludes deprecated rules, but the override keeps the scoping
      // self-contained). duplicate-id's only wcag tag is the obsolete variant,
      // which never matches a tag list, so it produces no override.
      rules: { "audio-caption": { enabled: false } },
    });
  },
);

unitTest(
  "axeScopeOptions - standard with no matching deprecated rules omits rules key",
  // deno-lint-ignore require-await
  async () => {
    // audio-caption (deprecated, wcag2a) matches every standard's tag list, so
    // use a catalog without deprecated rules to check the rules key is omitted.
    const currentOnly = rules.filter((r) => !r.tags.includes("deprecated"));
    assertEquals(axeScopeOptions({ standard: "wcag22aa" }, currentOnly), {
      runOnly: {
        type: "tag",
        // wcag22a currently matches no axe-core rules; it's listed anyway per
        // WCAG conformance logic (see STANDARD_TAGS) and axe accepts it.
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"],
      },
    });
  },
);

unitTest(
  "axeScopeOptions - best-practice: true appends the best-practice tag",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeScopeOptions({ standard: "wcag21aa", "best-practice": true }, rules),
      {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
        // audio-caption (deprecated, wcag2a) still matches the tag list
        rules: { "audio-caption": { enabled: false } },
      },
    );
  },
);

unitTest(
  "axeScopeOptions - best-practice: false without standard disables best-practice rules",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(axeScopeOptions({ "best-practice": false }, rules), {
      rules: { "heading-order": { enabled: false } },
    });
  },
);

unitTest(
  "axeScopeOptions - best-practice: false with standard is a no-op",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeScopeOptions({ standard: "wcag2a", "best-practice": false }, rules),
      axeScopeOptions({ standard: "wcag2a" }, rules),
    );
  },
);

unitTest(
  "axeScopeOptions - unknown standard falls back to the default scan",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(axeScopeOptions({ standard: "wcag3" }, rules), {});
  },
);
