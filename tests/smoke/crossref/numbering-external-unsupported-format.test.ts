/*
* numbering-external-unsupported-format.test.ts
*
* Final-review fix (C1/I1): `crossref-numbering: external` skips
* crossrefMetaInject() (LaTeX preamble for codelisting/theorem
* environments) and resolveRefs() (which stops Typst's native `@id`
* citation syntax from colliding with quarto's `@id` crossref syntax).
* Before the fix, this produced a cryptic downstream compiler crash:
* `LaTeX Error: Environment codelisting undefined` for latex/pdf/beamer,
* and `error: the document does not contain a bibliography` for typst.
* main.lua now fails fast, before Pandoc's writer runs, with a clear
* diagnostic naming the supported formats. Assert the diagnostic is
* present (as an ERROR-level record on the TS side) and that no output
* file is left behind.
*
* Copyright (C) 2026 Posit Software, PBC
*
*/

import { printsMessage } from "../../verify.ts";
import { testQuartoCmd } from "../../test.ts";
import { crossref } from "./utils.ts";

const diagnostic = printsMessage({
  level: "ERROR",
  regex:
    "crossref-numbering: external is not currently supported for .* output",
});

function removeIfExists(path: string) {
  try {
    Deno.removeSync(path);
  } catch {
    // expected: the guard fires before any output file is written
  }
}

for (const to of ["latex", "typst"]) {
  const fixture = crossref("numbering-external.qmd", to);
  testQuartoCmd(
    "render",
    [fixture.input, "--to", to],
    [diagnostic],
    {
      teardown: () => {
        removeIfExists(fixture.output.outputPath);
        return Promise.resolve();
      },
    },
    `quarto render crossref.numbering: external fails cleanly for --to ${to}`,
  );
}
