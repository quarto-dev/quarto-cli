/*
 * language-merge.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";

import { translationsForLang } from "../../../src/core/language.ts";
import {
  mergeFormatMetadata,
  mergeProjectMetadata,
} from "../../../src/config/metadata.ts";
import { FormatLanguage } from "../../../src/config/types.ts";

const kKey = "toc-title-document";
const kOtherKey = "toc-title-website";

type Layer = { language: FormatLanguage };

const kEarlyFr: Layer = {
  language: {
    [kKey]: "early",
    [kOtherKey]: "early other",
    fr: { [kKey]: "early fr", [kOtherKey]: "early other fr" },
    "fr-CA": { [kKey]: "early fr-CA" },
  },
};

function resolve(
  lang: string,
  key: string,
  merge: (config: Layer, ...configs: Layer[]) => Layer,
  ...layers: Layer[]
) {
  const [first, ...rest] = layers;
  return translationsForLang(merge(first, ...rest).language, lang)[key];
}

for (
  const [name, merge] of [
    ["mergeFormatMetadata", mergeFormatMetadata<Layer>],
    ["mergeProjectMetadata", mergeProjectMetadata<Layer>],
  ] as const
) {
  unitTest(
    `language-merge - ${name} - later plain key replaces earlier variations`,
    async () => {
      const late = { language: { [kKey]: "late" } };
      assertEquals(resolve("fr", kKey, merge, kEarlyFr, late), "late");
      assertEquals(resolve("fr-CA", kKey, merge, kEarlyFr, late), "late");
    },
  );

  unitTest(
    `language-merge - ${name} - earlier variation keeps other keys`,
    async () => {
      const late = { language: { [kKey]: "late" } };
      assertEquals(
        resolve("fr", kOtherKey, merge, kEarlyFr, late),
        "early other fr",
      );
    },
  );

  unitTest(
    `language-merge - ${name} - later variation replaces earlier plain key`,
    async () => {
      const late = { language: { [kKey]: "late", fr: { [kKey]: "late fr" } } };
      assertEquals(
        resolve("fr", kKey, merge, { language: { [kKey]: "early" } }, late),
        "late fr",
      );
    },
  );
}
