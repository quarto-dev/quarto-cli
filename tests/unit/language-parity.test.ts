/*
 * language-parity.test.ts
 *
 * Every base language file carries every key of _language.yml (or lists the
 * gap in language-known-gaps.yml), has no stale keys, and keeps the
 * placeholders of the English value.
 * See https://github.com/quarto-dev/quarto-cli/issues/14822
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { walkSync } from "../../src/deno_ral/fs.ts";
import { readYaml } from "../../src/core/yaml.ts";
import { resourcePath } from "../../src/core/resources.ts";

type Translations = Record<string, unknown>;

const placeholders = (value: unknown): string[] =>
  typeof value === "string"
    ? (value.match(/\{\d+\}/g) ?? []).sort()
    : [];

// Reads `_language.yml` and every `_language-<lang>.yml` in `dir`, keyed by <lang>.
function loadLanguageFiles(dir: string) {
  const english = readYaml(join(dir, "_language.yml")) as Translations;
  const languages = new Map<string, Translations>();
  for (const entry of walkSync(dir, { maxDepth: 1, includeDirs: false })) {
    const match = entry.name.match(/^_language-(.+)\.yml$/);
    if (match) {
      languages.set(match[1], readYaml(entry.path) as Translations);
    }
  }
  return { english, languages };
}

// Returns one line per problem; empty when the files are consistent.
// An overlay (`xx-YY` where `_language-xx.yml` exists) inherits from its base,
// so it may omit keys but not carry unknown ones.
function checkLanguageParity(
  english: Translations,
  languages: Map<string, Translations>,
  knownGaps: Record<string, string[]>,
): string[] {
  const problems: string[] = [];

  const isOverlay = (lang: string) =>
    lang.includes("-") && languages.has(lang.split("-")[0]);
  const gapped = (lang: string, key: string) =>
    knownGaps[key]?.includes(lang) ?? false;

  for (const [lang, translations] of languages) {
    for (const key of Object.keys(translations)) {
      if (!Object.hasOwn(english, key)) {
        problems.push(`${lang}: stale key '${key}' is not in _language.yml`);
      }
    }
    for (const key of Object.keys(english)) {
      if (!Object.hasOwn(translations, key)) {
        if (!isOverlay(lang) && !gapped(lang, key)) {
          problems.push(`${lang}: missing key '${key}'`);
        }
        continue;
      }
      const expected = placeholders(english[key]);
      const actual = placeholders(translations[key]);
      const nullOk = translations[key] === null && expected.length === 0;
      if (!nullOk && expected.join() !== actual.join()) {
        problems.push(
          `${lang}: '${key}' has placeholders [${actual}], expected [${expected}]`,
        );
      }
    }
  }

  for (const [key, langs] of Object.entries(knownGaps)) {
    if (!Object.hasOwn(english, key)) {
      problems.push(`known gap '${key}' is not a key in _language.yml`);
      continue;
    }
    for (const lang of langs) {
      const translations = languages.get(lang);
      if (!translations) {
        problems.push(`known gap '${key}' names unknown language '${lang}'`);
      } else if (Object.hasOwn(translations, key)) {
        problems.push(
          `known gap '${key}' for '${lang}' is stale: the key is now present`,
        );
      }
    }
  }

  return problems;
}

function parityOf(
  base: Translations,
  files: Record<string, Translations>,
  knownGaps: Record<string, string[]> = {},
): Promise<string[]> {
  return Promise.resolve(
    checkLanguageParity(base, new Map(Object.entries(files)), knownGaps),
  );
}

function assertOneProblem(problems: string[], ...fragments: string[]) {
  assertEquals(problems.length, 1, problems.join("\n"));
  for (const fragment of fragments) {
    assertEquals(
      problems[0].includes(fragment),
      true,
      `'${problems[0]}' should mention '${fragment}'`,
    );
  }
}

unitTest("parity - stale key fails", async () => {
  const problems = await parityOf({ a: "A" }, { xx: { a: "x", b: "y" } });
  assertOneProblem(problems, "xx", "b");
});

unitTest("parity - missing key fails unless known gap", async () => {
  const base = { a: "A", b: "B" };
  const files = { xx: { a: "x" } };
  assertOneProblem(await parityOf(base, files), "xx", "b");
  assertEquals(await parityOf(base, files, { b: ["xx"] }), []);
});

unitTest("parity - resolved known gap fails", async () => {
  const problems = await parityOf(
    { a: "A" },
    { xx: { a: "x" } },
    { a: ["xx"] },
  );
  assertOneProblem(problems, "stale", "xx");
});

unitTest("parity - overlay exempt from missing, not from stale", async () => {
  const base = { a: "A", b: "B" };
  const xx = { a: "x", b: "y" };
  assertEquals(await parityOf(base, { xx, "xx-YY": { a: "z" } }), []);
  assertOneProblem(
    await parityOf(base, { xx, "xx-YY": { a: "z", c: "w" } }),
    "xx-YY",
    "c",
  );
});

unitTest("parity - known gap for unknown language fails", async () => {
  const problems = await parityOf({ a: "A" }, { xx: { a: "x" } }, {
    a: ["zz"],
  });
  assertOneProblem(problems, "zz");
});

unitTest("parity - known gap for key not in _language.yml fails", async () => {
  const problems = await parityOf({ a: "A" }, { xx: { a: "x" } }, {
    gone: ["xx"],
  });
  assertOneProblem(problems, "gone");
});

unitTest("parity - duplicated placeholder fails", async () => {
  const base = { w: "{0} words" };
  assertOneProblem(
    await parityOf(base, { xx: { w: "{0} {0} mots" } }),
    "xx",
    "w",
  );
  assertEquals(await parityOf(base, { xx: { w: "{0} mots" } }), []);
  assertOneProblem(await parityOf(base, { xx: { w: "mots" } }), "xx", "w");
});

unitTest("parity - empty and null values count as present", async () => {
  assertEquals(await parityOf({ a: "" }, { xx: { a: null } }), []);
});

unitTest(
  "parity - null translation of a placeholder value fails",
  async () => {
    assertOneProblem(
      await parityOf({ w: "{0} words" }, { xx: { w: null } }),
      "xx",
      "w",
    );
  },
);

unitTest("parity - unexpected placeholder fails", async () => {
  assertOneProblem(
    await parityOf({ s: "Share" }, { xx: { s: "Partager {0}" } }),
    "xx",
    "s",
  );
});

unitTest(
  "parity - loads base, region and script language files",
  // deno-lint-ignore require-await
  async () => {
    const { english, languages } = loadLanguageFiles(resourcePath("language"));
    assertEquals(english["search-label"], "Search");
    for (const lang of ["fr", "fr-CA", "sr-Latn", "zh-TW"]) {
      assertEquals(languages.has(lang), true, `'${lang}' not loaded`);
    }
  },
);

unitTest(
  "parity - shipped language files match _language.yml",
  // deno-lint-ignore require-await
  async () => {
    const knownGaps = readYaml(
      join(import.meta.dirname!, "language-known-gaps.yml"),
    ) as Record<string, string[]>;
    const { english, languages } = loadLanguageFiles(resourcePath("language"));
    assertEquals(
      checkLanguageParity(english, languages, knownGaps ?? {}),
      [],
    );
  },
);
