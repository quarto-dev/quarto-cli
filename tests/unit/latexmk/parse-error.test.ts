/*
* parse-error.test.ts
*
* Copyright (C) 2023 Posit Software, PBC
*
*/

import { findMissingFontsAndPackages } from "../../../src/command/render/latexmk/parse-error.ts"
import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";

function fontSearchTerm(font: string): string {
  return `${font}(-(Bold|Italic|Regular).*)?[.](tfm|afm|mf|otf|ttf)`;
}

function assertFound(logText: string, expected: string, file?: string) {
  assert(
    findMissingFontsAndPackages(logText, ".")[0] === expected,
    `Expected \`${expected}\` in \"${file ?? logText}\" but not found.`
  )
}

unitTest("Detect missing files with `findMissingFontsAndPackages`", async () => {
  // No package found
  assert(findMissingFontsAndPackages("asdf qwer", ".").length === 0);
  // Mismatched LaTeX support (https://github.com/quarto-dev/quarto#7417)
  assertFound(Deno.readTextFileSync("expl3-aborted.log"), "expl3.sty", "expl3-aborted.log");
  // fonts
  assertFound("! Font U/psy/m/n/10=psyr at 10.0pt not loadable: Metric (TFM) file not found", fontSearchTerm("psyr"));
  assertFound('! The font "FandolSong-Regular" cannot be found.', fontSearchTerm("FandolSong-Regular"));
  assertFound('! Package fontspec Error: The font "Caladea" cannot be found.', fontSearchTerm("Caladea"));
  assertFound('!pdfTeX error: /usr/local/bin/pdflatex (file tcrm0700): Font tcrm0700 at 600 not found', fontSearchTerm("tcrm0700"))
  assertFound('(fontspec)                The font "LibertinusSerif-Regular" cannot be', fontSearchTerm("LibertinusSerif-Regular"));
  assertFound('! Font \\JY3/mc/m/n/10=file:HaranoAjiMincho-Regular.otf:-kern;jfm=ujis at 9.24713pt not loadable: metric data not found or bad.', "HaranoAjiMincho-Regular.otf");
  assertFound("! LaTeX Error: File `framed.sty' not found.", "framed.sty");
  assertFound("/usr/local/bin/mktexpk: line 123: mf: command not found", "mf");
  assertFound("or the language definition file ngerman.ldf was not found", "ngerman.ldf");
  assertFound("!pdfTeX error: pdflatex (file 8r.enc): cannot open encoding file for reading", "8r.enc");
  assertFound("! CTeX fontset `fandol' is unavailable in current mode", "fandol");
  assertFound('Package widetext error: Install the flushend package which is a part of sttools', "flushend.sty");
  assertFound('! Package isodate.sty Error: Package file substr.sty not found.', "substr.sty");
  assertFound("! Package fontenc Error: Encoding file `t2aenc.def' not found.", "t2aenc.def");
  assertFound("! I can't find file `hyph-de-1901.ec.tex'.", "hyph-de-1901.ec.tex");
  assertFound("luaotfload-features.lua:835: module 'lua-uni-normalize' not found:", "lua-uni-algos.lua");
},{
  cwd: () => "unit/latexmk/"
})