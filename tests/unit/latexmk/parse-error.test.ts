/*
* parse-error.test.ts
*
* Copyright (C) 2023 Posit Software, PBC
*
*/

import { findMissingFontsAndPackages, findMissingHyphenationFiles } from "../../../src/command/render/latexmk/parse-error.ts"
import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";

function fontSearchTerm(font: string): string {
  const fontPattern = font.replace(/\s+/g, '\\s*');
  return `${fontPattern}(-(Bold|Italic|Regular).*)?[.](tfm|afm|mf|otf|ttf)`;
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
  assertFound('! The font "Noto Emoji" cannot be found.', fontSearchTerm("Noto Emoji"));
  assertFound('! Package fontspec Error: The font "DejaVu Sans" cannot be found.', fontSearchTerm("DejaVu Sans"));
  assertFound("! LaTeX Error: File `framed.sty' not found.", "framed.sty");
  assertFound("! LaTeX Error: File 'framed.sty' not found.", "framed.sty");
  assertFound("/usr/local/bin/mktexpk: line 123: mf: command not found", "mf");
  assertFound("or the language definition file ngerman.ldf was not found", "ngerman.ldf");
  assertFound(`Package babel Error: Unknown option 'ngerman'. Either you misspelled it
    (babel)                or the language definition file ngerman.ldf
    (babel)                was not found.
    (babel)                There is a locale ini file for this language.
    (babel)                If it’s the main language, try adding \`provide=*'
    (babel)                to the babel package options.`, "ngerman.ldf")
  assertFound("! Package babel Error: Unknown option 'english'.", "english.ldf");
  assertFound(`! Package babel Error: Unknown option 'ngerman'.
(babel)                Suggested actions:
(babel)                * Make sure you haven't misspelled it`, "ngerman.ldf");
  assertFound("!pdfTeX error: pdflatex (file 8r.enc): cannot open encoding file for reading", "8r.enc");
  assertFound("! CTeX fontset `fandol' is unavailable in current mode", "fandol");
  assertFound("! CTeX fontset 'fandol' is unavailable in current mode", "fandol");
  assertFound('Package widetext error: Install the flushend package which is a part of sttools', "flushend.sty");
  assertFound('! Package isodate.sty Error: Package file substr.sty not found.', "substr.sty");
  assertFound("! Package fontenc Error: Encoding file `t2aenc.def' not found.", "t2aenc.def");
  assertFound("! I can't find file `hyph-de-1901.ec.tex'.", "hyph-de-1901.ec.tex");
  assertFound("! I can't find file 'hyph-de-1901.ec.tex'.", "hyph-de-1901.ec.tex");
  assertFound("luaotfload-features.lua:835: module 'lua-uni-normalize' not found:", "lua-uni-algos.lua");
  assertFound("! LuaTeX-ja error: File 'jfm-zh_CN.lua' not found.", "jfm-zh_CN.lua");

  // Additional test cases from tinytex R package examples (latex.R lines 537-607)
  // https://github.com/rstudio/tinytex/blob/e96be3143b9af07768a124215b5fb5a1e6d183d3/R/latex.R#L538-L558
  assertFound('xdvipdfmx:fatal: Unable to find TFM file "rsfs10"', fontSearchTerm("rsfs10"));
  assertFound("Package biblatex Info: ... file 'trad-abbrv.bbx' not found", "trad-abbrv.bbx");
  assertFound("! Package pdftex.def Error: File `logo-mdpi-eps-converted-to.pdf' not found", "epstopdf");
  assertFound("! Package pdftex.def Error: File 'logo-mdpi-eps-converted-to.pdf' not found", "epstopdf");
  assertFound("! xdvipdfmx:fatal: pdf_ref_obj(): passed invalid object.", "epstopdf");
  assertFound(
    "! Package tikz Error: I did not find the tikz library 'hobby'. This error message was issued because the library or one of its sublibraries could not be found, probably because of a misspelling. Processed options: \"library={hobby}\". The possibly misspelled library name is \"hobby\". The library name should be one of the following (or you misspelled it): named tikzlibraryhobby.code.tex",
    "tikzlibraryhobby.code.tex"
  );
  assertFound("support file `supp-pdf.mkii' (supp-pdf.tex) is missing", "supp-pdf.mkii");
  assertFound("support file 'supp-pdf.mkii' (supp-pdf.tex) is missing", "supp-pdf.mkii");
  assertFound("! Package pdfx Error: No color profile sRGB_IEC61966-2-1_black_scaled.icc found", "colorprofiles.sty");
  assertFound("No file LGRcmr.fd. ! LaTeX Error: This NFSS system isn't set up properly.", "lgrcmr.fd");
},{
  cwd: () => "unit/latexmk/"
})

unitTest("Detect missing hyphenation with babel warnings", async () => {
  // Test backtick-quote format (old format)
  const logWithBacktick = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language \`Spanish' into the format.
(babel)                Please, configure your TeX system to add them and
(babel)                rebuild the format. Now I will use the patterns
(babel)                preloaded for \\language=0 instead on input line 51.`;
  assert(
    findMissingHyphenationFiles(logWithBacktick) === "hyphen-spanish",
    "Should detect hyphen-spanish from backtick-quote format"
  );

  // Test straight-quote format (new format - the bug we're fixing)
  const logWithStraightQuotes = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'Spanish' into the format.
(babel)                Please, configure your TeX system to add them and
(babel)                rebuild the format. Now I will use the patterns
(babel)                preloaded for \\language=0 instead on input line 51.`;
  assert(
    findMissingHyphenationFiles(logWithStraightQuotes) === "hyphen-spanish",
    "Should detect hyphen-spanish from straight-quote format"
  );

  // Test ngerman special case (should return hyphen-german, not hyphen-ngerman)
  const logGerman = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'ngerman' into the format.`;
  assert(
    findMissingHyphenationFiles(logGerman) === "hyphen-german",
    "Should map ngerman to hyphen-german"
  );

  // Test Chinese - no hyphen package exists
  const logChinese = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'chinese' into the format.`;
  assert(
    findMissingHyphenationFiles(logChinese) === undefined,
    "Should return undefined for Chinese (no hyphen package)"
  );

  // Test alternative Info pattern (issue #10291)
  const logInfoChinese = `Package babel Info: Hyphen rules for 'chinese-hans' set to \\l@nil
(babel)             (\\language10). Reported on input line 143.`;
  assert(
    findMissingHyphenationFiles(logInfoChinese) === undefined,
    "Should return undefined for chinese-hans via Info pattern"
  );

  // Test no warning present
  const logNoWarning = "Some other log text without babel warnings";
  assert(
    findMissingHyphenationFiles(logNoWarning) === undefined,
    "Should return undefined when no babel warning present"
  );
}, {
  cwd: () => "unit/latexmk/"
})