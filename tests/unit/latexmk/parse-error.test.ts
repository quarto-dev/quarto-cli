/*
* parse-error.test.ts
*
* Copyright (C) 2023 Posit Software, PBC
*
*/

import { detectBabelFallback, findLatexError, findMissingFontsAndPackages, findMissingHyphenationFiles, findMissingHyphenationPackages } from "../../../src/command/render/latexmk/parse-error.ts"
import babelHyphen from "../../../src/command/render/latexmk/babel-hyphen.json" with { type: "json" };
import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";

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
  // luaotfload fallback-chain font (monofontfallback) - https://github.com/quarto-dev/quarto-cli/issues/14558
  // luaotfload appends ;-fallback internally; it must be stripped before building the search term
  assertFound('luaotfload | db : Reload initiated (formats: otf,ttf,ttc); reason: Font "DejaVu Sans Mono;-fallback" not found.', fontSearchTerm("DejaVu Sans Mono"));
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

// deno-lint-ignore require-await
unitTest("Detect luaotfload font fallback crash and surface an actionable hint", async () => {
  // The luaotfload font-fallback resolver crashes on recent TeX Live when a
  // fallback font is set (mainfontfallback/monofontfallback): define_font of the
  // internal `<font>;-fallback` name returns nil and luaotfload-fallback.lua
  // dereferences it. There is no `! ...Here is how much` block, so the generic
  // error extraction finds nothing — we want a specific, actionable message.
  // Upstream: https://github.com/latex3/luaotfload/issues/331
  const fallbackCrashLog =
    `luaotfload | db : Reload initiated (formats: otf,ttf,ttc); reason: Font "Latin Modern Roman;-fallback" not found.
luaotfload | resolve : sequence of 3 lookups yielded nothing appropriate....texmf-dist/tex/luatex/luaotfload/luaotfload-fallback.lua:50: attempt to index a nil value (local 'f').
!  ==> Fatal error occurred, no output PDF file produced!`;

  const message = findLatexError(fallbackCrashLog) ?? "";
  assert(
    message.includes("font fallback"),
    `Expected a font-fallback hint, got: "${message}"`,
  );
  assert(
    message.includes("luaotfload/issues/331"),
    `Expected the upstream issue link, got: "${message}"`,
  );
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Detect missing hyphenation with babel warnings", async () => {
  // Test backtick-quote format (old format)
  const logWithBacktick = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language \`Spanish' into the format.
(babel)                Please, configure your TeX system to add them and
(babel)                rebuild the format. Now I will use the patterns
(babel)                preloaded for \\language=0 instead on input line 51.`;
  assertEquals(
    findMissingHyphenationFiles(logWithBacktick),
    ["hyphen-spanish"],
    "Should detect hyphen-spanish from backtick-quote format"
  );

  // Test straight-quote format (new format - the bug we're fixing)
  const logWithStraightQuotes = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'Spanish' into the format.
(babel)                Please, configure your TeX system to add them and
(babel)                rebuild the format. Now I will use the patterns
(babel)                preloaded for \\language=0 instead on input line 51.`;
  assertEquals(
    findMissingHyphenationFiles(logWithStraightQuotes),
    ["hyphen-spanish"],
    "Should detect hyphen-spanish from straight-quote format"
  );

  // Test ngerman special case (should return hyphen-german, not hyphen-ngerman)
  const logGerman = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'ngerman' into the format.`;
  assertEquals(
    findMissingHyphenationFiles(logGerman),
    ["hyphen-german"],
    "Should map ngerman to hyphen-german"
  );

  // Test Chinese - no hyphen package exists
  const logChinese = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'chinese' into the format.`;
  assertEquals(
    findMissingHyphenationFiles(logChinese),
    [],
    "Should return nothing for Chinese (no hyphen package)"
  );

  // Test alternative Info pattern (issue #10291)
  const logInfoChinese = `Package babel Info: Hyphen rules for 'chinese-hans' set to \\l@nil
(babel)             (\\language10). Reported on input line 143.`;
  assertEquals(
    findMissingHyphenationFiles(logInfoChinese),
    [],
    "Should return nothing for chinese-hans via Info pattern"
  );

  // Test no warning present
  const logNoWarning = "Some other log text without babel warnings";
  assertEquals(
    findMissingHyphenationFiles(logNoWarning),
    [],
    "Should return nothing when no babel warning present"
  );
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Detect missing hyphenation causing a fatal babel error", async () => {
  // `lang: de-CH` without hyphen-german (https://github.com/rstudio/tinytex/issues/515):
  // babel-german defines nswissgerman as a dialect of the null language, but then
  // checks `\iflanguage{ngerman}`, which is a fatal error, so compilation fails.
  const logSwissGerman = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'German (current orthography), needed by Swiss Standard German (current orthography)' into the format.
(babel)                Please, configure your TeX system to add them and
(babel)                rebuild the format. Now I will use the patterns
(babel)                preloaded for \\language=0 instead on input line 1260.

Package babel Info: Hyphen rules for 'nswissgerman' set to \\l@nil
(babel)             (\\language5). Reported on input line 1260.

! Package babel Error: You haven't defined the language 'ngerman' yet.
(babel)                Perhaps you misspelled it or your installation
(babel)                is not complete.

See the babel package documentation for explanation.
Type  H <return>  for immediate help.`;
  assertEquals(
    findMissingHyphenationPackages(logSwissGerman),
    ["hyphen-german"],
    "Should map the undefined ngerman language to hyphen-german",
  );
  // The file-based search finds nothing for this error
  assertEquals(findMissingFontsAndPackages(logSwissGerman, "."), []);
  // The warning names a description, not a pattern name: the first word is
  // used, not the nswissgerman from the \l@nil line
  assertEquals(findMissingHyphenationFiles(logSwissGerman), ["hyphen-german"]);

  // Backtick-quote format (older babel)
  assertEquals(
    findMissingHyphenationPackages(
      "! Package babel Error: You haven't defined the language `ngerman' yet.",
    ),
    ["hyphen-german"],
  );
  // Unquoted format (older babel)
  assertEquals(
    findMissingHyphenationPackages(
      "! Package babel Error: You haven't defined the language ngerman yet.",
    ),
    ["hyphen-german"],
  );
  // Other languages are lowercased and prefixed
  assertEquals(
    findMissingHyphenationPackages(
      "! Package babel Error: You haven't defined the language 'Spanish' yet.",
    ),
    ["hyphen-spanish"],
  );
  // Languages without hyphenation package are ignored
  assertEquals(
    findMissingHyphenationPackages(
      "! Package babel Error: You haven't defined the language 'chinese-hans' yet.",
    ),
    [],
  );
  // Only the fatal error is considered, not babel warnings
  assertEquals(
    findMissingHyphenationPackages(`Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'Spanish' into the format.`),
    [],
  );
  assertEquals(findMissingHyphenationPackages("asdf qwer"), []);
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Drop hyphenation package names that are not valid package names", async () => {
  // Language names come from the log and end up as tlmgr arguments, which
  // go through a .bat file on Windows
  for (const lang of ['x"&calc', "ngerman;id", "%PATH%", "a|b", "a^b", "--repository=x"]) {
    assertEquals(
      findMissingHyphenationPackages(
        `! Package babel Error: You haven't defined the language '${lang}' yet.`,
      ),
      [],
      `Should drop '${lang}' from the babel error`,
    );
    assertEquals(
      findMissingHyphenationFiles(`Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language '${lang}' into the format.`),
      [],
      `Should drop '${lang}' from the babel warning`,
    );
  }
  // Valid names are kept
  assertEquals(
    findMissingHyphenationPackages(
      `! Package babel Error: You haven't defined the language 'x"&calc' yet.
! Package babel Error: You haven't defined the language 'french' yet.`,
    ),
    ["hyphen-french"],
  );
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Map hyphenation language names to their TeX Live package", async () => {
  // Names whose package is not hyphen-<name>, according to
  // `execute AddHyphen` (name= and synonyms=) in texlive.tlpdb
  const expected: Record<string, string> = {
    ngerman: "hyphen-german",
    swissgerman: "hyphen-german",
    pinyin: "hyphen-chinese",
    ukenglish: "hyphen-english",
    british: "hyphen-english",
    usenglishmax: "hyphen-english",
    bokmal: "hyphen-norwegian",
    norsk: "hyphen-norwegian",
    nynorsk: "hyphen-norwegian",
    schoolfinnish: "hyphen-finnish",
    monogreek: "hyphen-greek",
    polygreek: "hyphen-greek",
    ibycus: "hyphen-ancientgreek",
    classiclatin: "hyphen-latin",
    liturgicallatin: "hyphen-latin",
    mongolianlmc: "hyphen-mongolian",
    serbianc: "hyphen-serbian",
    amharic: "hyphen-ethiopic",
    geez: "hyphen-ethiopic",
    persian: "hyphen-farsi",
    patois: "hyphen-french",
    francais: "hyphen-french",
    portuges: "hyphen-portuguese",
    slovene: "hyphen-slovenian",
    espanol: "hyphen-spanish",
    assamese: "hyphen-indic",
    bengali: "hyphen-indic",
    gujarati: "hyphen-indic",
    hindi: "hyphen-indic",
    kannada: "hyphen-indic",
    malayalam: "hyphen-indic",
    marathi: "hyphen-indic",
    oriya: "hyphen-indic",
    pali: "hyphen-indic",
    panjabi: "hyphen-indic",
    tamil: "hyphen-indic",
    telugu: "hyphen-indic",
    // pinned German patterns are not in a hyphen-* package
    "german-x-latest": "dehyph-exptl",
    "ngerman-x-latest": "dehyph-exptl",
    "german-x-2024-02-28": "dehyph-exptl",
    "ngerman-x-2024-02-28": "dehyph-exptl",
  };
  for (const [lang, pkg] of Object.entries(expected)) {
    assertEquals(
      findMissingHyphenationPackages(
        `! Package babel Error: You haven't defined the language '${lang}' yet.`,
      ),
      [pkg],
      `Should map '${lang}' to ${pkg} from the babel error`,
    );
    assertEquals(
      findMissingHyphenationFiles(`Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language '${lang}' into the format.`),
      [pkg],
      `Should map '${lang}' to ${pkg} from the babel warning`,
    );
  }
  // Names in language.dat may be in mixed case
  assertEquals(
    findMissingHyphenationPackages(
      "! Package babel Error: You haven't defined the language 'UKenglish' yet.",
    ),
    ["hyphen-english"],
  );
  // Several languages from the same package are installed once
  assertEquals(
    findMissingHyphenationPackages(
      `! Package babel Error: You haven't defined the language 'hindi' yet.
! Package babel Error: You haven't defined the language 'tamil' yet.`,
    ),
    ["hyphen-indic"],
  );
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Detect missing pinned German hyphenation patterns", async () => {
  // `\begin{hyphenrules}{ngerman-x-latest}` (or `\selectlanguage`) without
  // dehyph-exptl installed
  const log = `! Package babel Error: You haven't defined the language 'ngerman-x-latest' yet.
(babel)                Perhaps you misspelled it or your installation
(babel)                is not complete.

See the babel package documentation for explanation.
Type  H <return>  for immediate help.
 ...

l.185 \\begin{hyphenrules}{ngerman-x-latest}`;
  assertEquals(findMissingHyphenationPackages(log), ["dehyph-exptl"]);
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Ignore babel info messages naming a language", async () => {
  // Only warning blocks are searched: the (babel) continuation of an Info
  // message is not a missing-patterns warning
  const info = `Package babel Info: No hyphenation patterns were set for
(babel)             language 'nohyphenation'. Reported on input line 12.`;
  assertEquals(findMissingHyphenationFiles(info), []);

  // same with an unrelated warning elsewhere in the log
  const withWarning = `Package babel Warning: Something else
(babel)                on input line 3.

${info}`;
  assertEquals(findMissingHyphenationFiles(withWarning), []);
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Detect every language missing hyphenation patterns", async () => {
  // babel warns once per language
  const babel = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'Spanish' into the format.

Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'Italian' into the format.`;
  assertEquals(findMissingHyphenationFiles(babel), ["hyphen-spanish", "hyphen-italian"]);

  // polyglossia, real xelatex log with \setotherlanguages{spanish,italian}
  const polyglossia = `Package polyglossia Warning: No hyphenation patterns were loaded for \`spanish'
(polyglossia)                I will use \\language=\\l@nohyphenation instead.

Package polyglossia Warning: No hyphenation patterns were loaded for \`italian'
(polyglossia)                I will use \\language=\\l@nohyphenation instead.`;
  assertEquals(findMissingHyphenationFiles(polyglossia), ["hyphen-spanish", "hyphen-italian"]);

  // polyglossia also reports some languages by their description
  assertEquals(
    findMissingHyphenationFiles("Package polyglossia Warning: No hyphenation patterns were loaded for British English"),
    ["hyphen-english"],
  );
  // the same package is installed once
  assertEquals(findMissingHyphenationFiles(`${babel}\n\n${polyglossia}`), ["hyphen-spanish", "hyphen-italian"]);
  // two languages, one package: deduplicated after mapping
  const indic = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'hindi' into the format.

Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'tamil' into the format.`;
  assertEquals(findMissingHyphenationFiles(indic), ["hyphen-indic"]);
  assertEquals(findMissingHyphenationFiles("asdf qwer"), []);
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Detect missing hyphenation from a language description with spaces", async () => {
  // babel-german describes the patterns it needs instead of naming them,
  // e.g. `\@nopatterns{German (current orthography)}` in babel-german.def
  const log = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'German (current orthography)' into the format.
(babel)                Please, configure your TeX system to add them and
(babel)                rebuild the format. Now I will use the patterns
(babel)                preloaded for \\language=0 instead on input line 1260.`;
  assertEquals(findMissingHyphenationFiles(log), ["hyphen-german"]);
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("babel-hyphen.json maps are well-formed", async () => {
  const maps: Record<string, Record<string, string>> = babelHyphen;
  const keyPattern: Record<string, RegExp> = {
    hyphen_synonyms: /^[a-z0-9-]+$/,
    babel_hyphen_map: /^[a-z0-9.-]+$/,
    babel_hyphen_codes: /^[a-z0-9-]+$/,
  };
  for (const [name, keys] of Object.entries(keyPattern)) {
    const map = maps[name];
    assert(Object.keys(map).length > 0, `${name} is empty`);
    for (const [k, v] of Object.entries(map)) {
      assert(keys.test(k), `${name} key ${k} is malformed`);
      assert(/^[a-z0-9-]+$/.test(v), `${name}[${k}] = ${v} is malformed`);
    }
  }
  const map = maps.babel_hyphen_map;
  assertEquals(map["spanish"], "spanish");
  assertEquals(map["mexican"], "spanish");
  assertEquals(map["spanish-mx"], "spanish");
  assertEquals(map["canadianfrench"], "french");
  assertEquals(map["austrian"], "ngerman-x-latest");
  const codes = maps.babel_hyphen_codes;
  assertEquals(codes["es"], "spanish");
  assertEquals(codes["es-mx"], "spanish");
  assertEquals(codes["fr-ca"], "french");
  assertEquals(codes["de-at"], "ngerman-x-latest");
  assertEquals(maps.hyphen_synonyms["ngerman-x-latest"], "ngerman-x-2024-02-28");
}, {
  cwd: () => "unit/latexmk/"
})

unitTest("Detect missing hyphenation patterns for babel .ini locales", async () => {
  // Real lualatex logs from rstudio/tinytex#522 (babel v26.13, TeX Live 2026):
  // babel loads a language from its .ini file and, without the patterns,
  // silently falls back to another language with an Info line only.
  const spanish = [
    "Package babel Info: Importing data for 'spanish'",
    "(babel)             from babel-es.ini. Reported on input line 3.",
    "Package babel Info: Hyphen rules for 'spanish' set to \\l@english",
    "(babel)             (\\language0). Reported on input line 3.",
  ];
  const x = spanish.join("\n");

  // \babelprovide[import]{canadianfrench,austrian,mexican} with hyphen-english,
  // hyphen-french and hyphen-german installed: only mexican is a fallback. The
  // english.ldf dialects (canadian, australian) have no Importing line.
  const y = [
    "Package babel Info: Importing font and identification data for 'english'",
    "(babel)             from babel-en.ini. Reported on input line 4478.",
    "Package babel Info: Hyphen rules for 'canadian' set to \\l@english",
    "(babel)             (\\language0). Reported on input line 102.",
    "Package babel Info: Hyphen rules for 'australian' set to \\l@ukenglish",
    "(babel)             (\\language6). Reported on input line 105.",
    "Package babel Info: Importing data for 'canadianfrench'",
    "(babel)             from babel-fr-CA.ini. Reported on input line 3.",
    "Package babel Info: Hyphen rules for 'canadianfrench' set to \\l@french",
    "(babel)             (\\language8). Reported on input line 3.",
    "Package babel Info: Importing data for 'austrian'",
    "(babel)             from babel-de-AT.ini. Reported on input line 4.",
    "Package babel Info: Hyphen rules for 'austrian' set to \\l@ngerman-x-2024-02-28",
    "(babel)             (\\language5). Reported on input line 4.",
    "Package babel Info: Importing data for 'mexican'",
    "(babel)             from babel-es-MX.ini. Reported on input line 5.",
    "Package babel Info: Hyphen rules for 'mexican' set to \\l@english",
    "(babel)             (\\language0). Reported on input line 5.",
  ].join("\n");

  // a fallback to \l@nil (no hyphenation) is a fallback too (#8684)
  const z = [
    "Package babel Info: Importing data for 'spanish'",
    "(babel)             from babel-es.ini. Reported on input line 3.",
    "Package babel Info: Hyphen rules for 'spanish' set to \\l@nil",
    "(babel)             (\\language23). Reported on input line 3.",
  ].join("\n");

  // custom language names: only the .ini file name points to the patterns
  const w = [
    "Package babel Info: Importing data for 'myspanish'",
    "(babel)             from babel-es.ini. Reported on input line 3.",
    "Package babel Info: Hyphen rules for 'myspanish' set to \\l@english",
    "(babel)             (\\language0). Reported on input line 3.",
    "Package babel Info: Importing data for 'mycanadian'",
    "(babel)             from babel-fr-CA.ini. Reported on input line 3.",
    "Package babel Info: Hyphen rules for 'mycanadian' set to \\l@french",
    "(babel)             (\\language8). Reported on input line 3.",
  ].join("\n");

  assertEquals(findMissingHyphenationFiles(x), ["hyphen-spanish"]);
  assertEquals(findMissingHyphenationFiles(y), ["hyphen-spanish"]);
  assertEquals(findMissingHyphenationFiles(z), ["hyphen-spanish"]);
  assertEquals(findMissingHyphenationFiles(w), ["hyphen-spanish"]);
  for (const log of [x, y, z, w]) {
    assertEquals(detectBabelFallback(log), ["hyphen-spanish"]);
  }
  assertEquals(detectBabelFallback(""), []);

  // no Importing line: no detection
  assertEquals(
    findMissingHyphenationFiles("Package babel Info: Hyphen rules for 'spanish' set to \\l@english"),
    [],
  );
  assertEquals(findMissingHyphenationFiles(""), []);

  // locale names that are properties of Object.prototype are not in the maps
  assertEquals(
    findMissingHyphenationFiles([
      "Package babel Info: Importing data for 'constructor'",
      "(babel)             from babel-toString.ini. Reported on input line 3.",
      "Package babel Info: Hyphen rules for 'constructor' set to \\l@english",
    ].join("\n")),
    [],
  );

  // Windows TeX logs use CRLF
  assertEquals(findMissingHyphenationFiles(spanish.join("\r\n")), ["hyphen-spanish"]);

  // synthetic log: language.dat names can be mixed case (UKenglish)
  assertEquals(
    findMissingHyphenationFiles([
      "Package babel Info: Importing data for 'british'",
      "(babel)             from babel-en-GB.ini. Reported on input line 3.",
      "Package babel Info: Hyphen rules for 'british' set to \\l@UKenglish",
    ].join("\n")),
    [],
  );

  // synthetic logs: an .ini without hyphenrules (not in babel_hyphen_codes)
  // expects the patterns named like the locale if it is a language.dat name
  assertEquals(
    findMissingHyphenationFiles([
      "Package babel Info: Importing data for 'swissgerman'",
      "(babel)             from babel-gsw.ini. Reported on input line 3.",
      "Package babel Info: Hyphen rules for 'swissgerman' set to \\l@english",
    ].join("\n")),
    ["hyphen-german"],
  );
  // ... and expects none otherwise (#10291)
  assertEquals(
    findMissingHyphenationFiles([
      "Package babel Info: Importing data for 'chinese'",
      "(babel)             from babel-zh.ini. Reported on input line 3.",
      "Package babel Info: Hyphen rules for 'chinese' set to \\l@nil",
    ].join("\n")),
    [],
  );

  // warnings first, then the fallback
  const italian = `Package babel Warning: No hyphenation patterns were preloaded for
(babel)                the language 'Italian' into the format.`;
  assertEquals(
    findMissingHyphenationFiles(`${x}\n\n${italian}`),
    ["hyphen-italian", "hyphen-spanish"],
  );
}, {
  cwd: () => "unit/latexmk/"
})
