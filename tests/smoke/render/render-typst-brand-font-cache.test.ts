/*
 * render-typst-brand-font-cache.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { test } from "../../test.ts";
import { quarto } from "../../../src/quarto.ts";
import { ensureFileRegexMatches, noErrors } from "../../verify.ts";

const dir = Deno.makeTempDirSync({ prefix: "quarto-14993-" });

const doc = (fonts: string[], base: string, body: string) =>
  `---
format: typst
keep-typ: true
brand:
  typography:
    fonts:
${fonts.map((f) => `      - family: ${f}\n        source: google`).join("\n")}
    base:
      family: ${base}
---

${body}
`;

test({
  name: "render - typst brand font downloaded by a later document is kept (#14993)",
  context: {
    setup: async () => {
      Deno.writeTextFileSync(
        join(dir, "first.qmd"),
        doc(["Tiny5"], "Tiny5", "First document."),
      );
      Deno.writeTextFileSync(
        join(dir, "second.qmd"),
        doc(["Barrio"], '"Barrio, Libertinus Serif"', "Second document."),
      );
    },
    teardown: async () => {
      try {
        Deno.removeSync(dir, { recursive: true });
      } catch {
        // tolerate Windows file locks
      }
    },
  },
  execute: async () => {
    await quarto(["render", join(dir, "first.qmd")]);
    await quarto(["render", join(dir, "second.qmd")]);
  },
  verify: [
    noErrors,
    ensureFileRegexMatches(join(dir, "second.typ"), [
      /font: \("Barrio", "Libertinus Serif"\)/,
    ]),
  ],
  type: "smoke",
});
