/*
 * babel-hyphen.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import {
  kBabelHyphenCodes,
  kBabelHyphenMap,
  kHyphenSynonyms,
} from "../../../src/command/render/latexmk/babel-hyphen.ts";
import { readTextFileSync } from "../../../src/deno_ral/fs.ts";
import { renderBabelHyphenModule } from "../../../tools/update-babel-hyphen.ts";
import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "../../asserts.ts";
import { unitTest } from "../../test.ts";

// deno-lint-ignore require-await
unitTest("Render babel hyphenation tables deterministically", async () => {
  const output = renderBabelHyphenModule({
    hyphen_synonyms: { b: "y", a: "x" },
    babel_hyphen_map: { es: "spanish" },
    babel_hyphen_codes: {},
  });

  assert(
    output.indexOf('"a": "x",') < output.indexOf('"b": "y",'),
    "Table keys should be sorted by code unit",
  );
  assertStringIncludes(
    output,
    'export const kBabelHyphenCodes: Record<string, string> = {\n};',
  );
  assertStringIncludes(output, "Do not edit by hand");
  assert(output.endsWith("};\n"), "The module should end with a newline");
});

// deno-lint-ignore require-await
unitTest("Reject malformed babel hyphenation tables", async () => {
  assertThrows(
    () =>
      renderBabelHyphenModule({
        hyphen_synonyms: {},
        babel_hyphen_map: {},
      }),
    Error,
    "babel_hyphen_codes",
  );
  assertThrows(
    () =>
      renderBabelHyphenModule({
        hyphen_synonyms: { a: 1 },
        babel_hyphen_map: {},
        babel_hyphen_codes: {},
      }),
    Error,
    "hyphen_synonyms",
  );
});

// deno-lint-ignore require-await
unitTest("Generated babel hyphenation module matches the generator", async () => {
  const committed = readTextFileSync(
    "../../../src/command/render/latexmk/babel-hyphen.ts",
  ).replaceAll("\r\n", "\n");
  const generated = renderBabelHyphenModule({
    hyphen_synonyms: kHyphenSynonyms,
    babel_hyphen_map: kBabelHyphenMap,
    babel_hyphen_codes: kBabelHyphenCodes,
  });
  assertEquals(generated, committed);
}, {
  cwd: () => "unit/latexmk/",
});

// deno-lint-ignore require-await
unitTest("Babel hyphenation tables are well formed", async () => {
  const tables = {
    hyphen_synonyms: kHyphenSynonyms,
    babel_hyphen_map: kBabelHyphenMap,
    babel_hyphen_codes: kBabelHyphenCodes,
  };
  for (const [name, table] of Object.entries(tables)) {
    assert(Object.keys(table).length > 0, `${name} should not be empty`);
    for (const [key, value] of Object.entries(table)) {
      const keyPattern = name === "babel_hyphen_map"
        ? /^[a-z0-9.-]+$/
        : /^[a-z0-9-]+$/;
      assert(keyPattern.test(key), `Invalid ${name} key: ${key}`);
      assert(/^[a-z0-9-]+$/.test(value), `Invalid ${name} value: ${value}`);
    }
  }

  assertEquals(kBabelHyphenMap.spanish, "spanish");
  assertEquals(kBabelHyphenMap.mexican, "spanish");
  assertEquals(kBabelHyphenMap["spanish-mx"], "spanish");
  assertEquals(kBabelHyphenMap.canadianfrench, "french");
  assertEquals(kBabelHyphenMap.austrian, "ngerman-x-latest");

  assertEquals(kBabelHyphenCodes.es, "spanish");
  assertEquals(kBabelHyphenCodes["es-mx"], "spanish");
  assertEquals(kBabelHyphenCodes["fr-ca"], "french");
  assertEquals(kBabelHyphenCodes["de-at"], "ngerman-x-latest");

  assertEquals(
    kHyphenSynonyms["ngerman-x-latest"],
    "ngerman-x-2024-02-28",
  );
});
