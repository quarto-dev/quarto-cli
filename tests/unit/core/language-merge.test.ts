/*
 * language-merge.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";

import { translationsForLang } from "../../../src/core/language.ts";
import { mergeFormatMetadata } from "../../../src/config/metadata.ts";
import { FormatLanguage } from "../../../src/config/types.ts";

const kKey = "toc-title-document";

type Layer = { language: FormatLanguage };

function resolve(lang: string, ...languages: FormatLanguage[]) {
  const [first, ...rest] = languages.map((language): Layer => ({ language }));
  const merged = mergeFormatMetadata<Layer>(first, ...rest);
  return translationsForLang(merged.language, lang)[kKey];
}

unitTest(
  "language-merge - later plain key replaces earlier variation",
  async () => {
    assertEquals(
      resolve("fr", { [kKey]: "early", fr: { [kKey]: "early fr" } }, {
        [kKey]: "late",
      }),
      "late",
    );
  },
);

unitTest(
  "language-merge - later key replaces every earlier variation",
  async () => {
    assertEquals(
      resolve("fr-CA", {
        [kKey]: "early",
        fr: { [kKey]: "early fr" },
        "fr-CA": { [kKey]: "early fr-CA" },
      }, { [kKey]: "late" }),
      "late",
    );
  },
);

unitTest("language-merge - variation wins in its own language", async () => {
  assertEquals(
    resolve("fr", { [kKey]: "early", fr: { [kKey]: "early fr" } }),
    "early fr",
  );
});

unitTest(
  "language-merge - later variation replaces earlier plain key",
  async () => {
    assertEquals(
      resolve("fr", { [kKey]: "early" }, {
        [kKey]: "late",
        fr: { [kKey]: "late fr" },
      }),
      "late fr",
    );
  },
);

unitTest(
  "language-merge - other keys of earlier variation remain",
  async () => {
    const merged = mergeFormatMetadata<Layer>(
      { language: { fr: { [kKey]: "early fr", "toc-title-website": "site" } } },
      { language: { [kKey]: "late" } },
    );
    assertEquals(
      translationsForLang(merged.language, "fr")["toc-title-website"],
      "site",
    );
  },
);
