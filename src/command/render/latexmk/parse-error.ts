/*
 * log.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import * as ld from "../../../core/lodash.ts";

import { lines } from "../../../core/text.ts";

// The missing font log file name
export const kMissingFontLog = "missfont.log";

// Reads log files and returns a list of search terms to use
// to find packages to install
export function findMissingFontsAndPackages(
  logText: string,
  dir: string,
): string[] {
  // Look for missing fonts
  const missingFonts = findMissingFonts(dir);

  // Look in the log file itself
  const missingPackages = findMissingPackages(logText);

  return ld.uniq([...missingPackages, ...missingFonts]);
}

// Does the log file indicate recompilation is neeeded
export function needsRecompilation(log: string) {
  if (existsSync(log)) {
    const logContents = Deno.readTextFileSync(log);

    // First look for an explicit request to recompile
    const explicitMatches = explicitMatchers.some((matcher) => {
      return logContents.match(matcher);
    });

    // If there are no explicit requests to re-compile
    // Look for unresolved 'resolving' matches
    if (explicitMatches) {
      return true;
    } else {
      const unresolvedMatches = resolvingMatchers.some((resolvingMatcher) => {
        // First see if there is a message indicating a match of something that
        // might subsequently resolve
        resolvingMatcher.unresolvedMatch.lastIndex = 0;
        let unresolvedMatch = resolvingMatcher.unresolvedMatch.exec(
          logContents,
        );
        const unresolvedMatches = [];

        while (unresolvedMatch) {
          // Now look for a message indicating that the issue
          // has been resolved
          const resolvedRegex = new RegExp(
            resolvingMatcher.resolvedMatch.replace(
              kCaptureToken,
              unresolvedMatch[1],
            ),
            "gm",
          );

          if (!logContents.match(resolvedRegex)) {
            unresolvedMatches.push(unresolvedMatch[1]);
          }

          // Continue looking for other unresolved matches
          unresolvedMatch = resolvingMatcher.unresolvedMatch.exec(
            logContents,
          );
        }

        if (unresolvedMatches.length > 0) {
          // There is an unresolved match
          return true;
        } else {
          // There is not an unresolved match
          return false;
        }
      });
      return !!unresolvedMatches;
    }
  }
  return false;
}
const explicitMatchers = [
  /(Rerun to get | Please \(re\)run | [rR]erun LaTeX\.)/, // explicitly request recompile
  /^No file .*?.aux\.\s*$/gm, // missing aux file from a beamer run using lualatex #6226
];

// Resolving matchers are matchers that may resolve later in the log
// So inspect the for the first match, then if there is a match,
// inspect for the second match, which will indicate that the issue has
// been resolved.
// For example:
// Package marginnote Info: xpos seems to be \@mn@currxpos  on input line 213.   <- unpositioned element
// Package marginnote Info: xpos seems to be 367.46002pt on input line 213.      <- positioned later in the log
const kCaptureToken = "${unresolvedCapture}";
const resolvingMatchers = [
  {
    unresolvedMatch: /^.*xpos seems to be \\@mn@currxpos.*?line ([0-9]*)\.$/gm,
    resolvedMatch:
      `^.*xpos seems to be [0-9]*\.[0-9]*pt.*?line ${kCaptureToken}\.$`,
  },
];

// Finds missing hyphenation files (these appear as warnings in the log file)
export function findMissingHyphenationFiles(logText: string) {
  const babelWarningRegex = /^Package babel Warning:/m;
  const hasWarning = logText.match(babelWarningRegex);
  if (hasWarning) {
    const languageRegex = /^\(babel\).* language `(\S+)'.*$/m;
    const languageMatch = logText.match(languageRegex);
    if (languageMatch) {
      const language = languageMatch[1];
      return `hyphen-${language.toLowerCase()}`;
    }
  }

  // Try an alternative way of parsing
  const hyphenRulesRegex =
    /Package babel Info: Hyphen rules for '(.*?)' set to \\l@nil/m;
  const match = logText.match(hyphenRulesRegex);
  if (match) {
    const language = match[1];
    if (language) {
      //ngerman gets special cased
      const filterLang = (lang: string) => {
        // NOTE Although the names of the corresponding lfd files match those in this list,
        // there are some exceptions, particularly in German and Serbian. So, ngerman is
        // called here german, which is the name in the CLDR and, actually, the most logical.
        //
        // See https://ctan.math.utah.edu/ctan/tex-archive/macros/latex/required/babel/base/babel.pdf
        if (lang === "ngerman") {
          return "german";
        }
        return lang;
      };

      return `hyphen-${filterLang(language.toLowerCase())}`;
    }
  }
}

// Parse a log file to find latex errors
const kErrorRegex = /^\!\s([\s\S]+)?Here is how much/m;
const kEmptyRegex = /(No pages of output)\./;

export function findLatexError(
  logText: string,
  stderr?: string,
): string | undefined {
  const errors: string[] = [];

  const match = logText.match(kErrorRegex);
  if (match) {
    const hint = suggestHint(logText, stderr);
    if (hint) {
      errors.push(`${match[1]}\n${hint}`);
    } else {
      errors.push(match[1]);
    }
  }

  if (errors.length === 0) {
    const emptyMatch = logText.match(kEmptyRegex);
    if (emptyMatch) {
      errors.push(
        `${emptyMatch[1]} - the document appears to have produced no output.`,
      );
    }
  }

  return errors.join("\n");
}

// Find the index error message
const kIndexErrorRegex = /^\s\s\s--\s(.*)/m;
export function findIndexError(logText: string): string | undefined {
  const match = logText.match(kIndexErrorRegex);
  if (match) {
    return match[1];
  } else {
    return undefined;
  }
}

// Search the missing font log for fonts
function findMissingFonts(dir: string): string[] {
  const missingFonts = [];
  // Look in the missing font file for any missing fonts
  const missFontLog = join(dir, kMissingFontLog);
  if (existsSync(missFontLog)) {
    const missFontLogText = Deno.readTextFileSync(missFontLog);
    const fontSearchTerms = findInMissingFontLog(missFontLogText);
    missingFonts.push(...fontSearchTerms);
  }
  return missingFonts;
}

const formatFontFilter = (match: string, _text: string) => {
  const base = basename(match);
  return fontSearchTerm(base);
};

const estoPdfFilter = (_match: string, _text: string) => {
  return "epstopdf";
};

const packageMatchers = [
  // Fonts
  {
    regex: /.*! Font [^=]+=([^ ]+).+ not loadable.*/g,
    filter: formatFontFilter,
  },
  {
    regex: /.*! .*The font "([^"]+)" cannot be found.*/g,
    filter: formatFontFilter,
  },
  {
    regex: /.*!.+ error:.+\(file ([^)]+)\): .*/g,
    filter: formatFontFilter,
  },
  {
    regex: /.*Package widetext error: Install the ([^ ]+) package.*/g,
    filter: (match: string, _text: string) => {
      return `${match}.sty`;
    },
  },
  {
    regex: /.*Unable to find TFM file "([^"]+)".*/g,
    filter: formatFontFilter,
  },

  { regex: /.* File `(.+eps-converted-to.pdf)'.*/g, filter: estoPdfFilter },
  { regex: /.*xdvipdfmx:fatal: pdf_ref_obj.*/g, filter: estoPdfFilter },

  {
    regex: /.* (tikzlibrary[^ ]+?[.]code[.]tex).*/g,
    filter: (match: string, text: string) => {
      if (text.match(/! Package tikz Error:/)) {
        return match;
      } else {
        return undefined;
      }
    },
  },
  {
    regex: /module 'lua-uni-normalize' not found:/g,
    filter: (_match: string, _text: string) => {
      return "lua-uni-algos.lua";
    },
  },
  { regex: /.* Loading '([^']+)' aborted!.*/g },
  { regex: /.*! LaTeX Error: File `([^']+)' not found.*/g },
  { regex: /.* file ['`]?([^' ]+)'? not found.*/g },
  { regex: /.*the language definition file ([^ ]+) .*/g },
  { regex: /.* \\(file ([^)]+)\\): cannot open .*/g },
  { regex: /.*file `([^']+)' .*is missing.*/g },
  { regex: /.*! CTeX fontset `([^']+)' is unavailable.*/g },
  { regex: /.*: ([^:]+): command not found.*/g },
  { regex: /.*! I can't find file `([^']+)'.*/g },
];

function fontSearchTerm(font: string): string {
  return `${font}(-(Bold|Italic|Regular).*)?[.](tfm|afm|mf|otf|ttf)`;
}

function findMissingPackages(logFileText: string): string[] {
  const toInstall: string[] = [];

  packageMatchers.forEach((packageMatcher) => {
    packageMatcher.regex.lastIndex = 0;
    let match = packageMatcher.regex.exec(logFileText);
    while (match != null) {
      const file = match[1];
      // Apply the filter, if there is one
      const filteredFile = packageMatcher.filter
        ? packageMatcher.filter(file, logFileText)
        : file;

      // Capture any matches
      if (filteredFile) {
        toInstall.push(filteredFile);
      }

      match = packageMatcher.regex.exec(logFileText);
    }
    packageMatcher.regex.lastIndex = 0;
  });

  // dedpulicated list of packages to attempt to install
  return ld.uniq(toInstall);
}

function findInMissingFontLog(missFontLogText: string): string[] {
  const toInstall: string[] = [];
  lines(missFontLogText).forEach((line) => {
    // Trim the line
    line = line.trim();

    // Extract the font from the end of the line
    const fontMatch = line.match(/([^\s]*)$/);
    if (fontMatch && fontMatch[1].trim() !== "") {
      toInstall.push(fontMatch[1]);
    }

    // Extract the font install command from the front of the line
    // Also request that this be installed
    const commandMatch = line.match(/^([^\s]*)/);
    if (commandMatch && commandMatch[1].trim() !== "") {
      toInstall.push(commandMatch[1]);
    }
  });

  // deduplicated list of fonts and font install commands
  return ld.uniq(toInstall);
}

const kUnicodePattern = {
  regex: /\! Package inputenc Error: Unicode character/,
  hint:
    "Possible unsupported unicode character in this configuration. Perhaps try another LaTeX engine (e.g. XeLaTeX).",
};

const kInlinePattern = {
  regex: /Missing \$ inserted\./,
  hint: "You may need to $ $ around an expression in this file.",
};

const kGhostPattern = {
  regex: /^\!\!\! Error: Cannot open Ghostscript for piped input/m,
  hint:
    "GhostScript is likely required to compile this document. Please be sure GhostScript (https://ghostscript.com) is installed and try again.",
};

const kGhostCorruptPattern = {
  regex: /^GPL Ghostscript .*: Can't find initialization file gs_init.ps/m,
  hint:
    "GhostScript is likely required to compile this document. Please be sure GhostScript (https://ghostscript.com) is installed and configured properly and try again.",
};

const kLogOutputPatterns = [kUnicodePattern, kInlinePattern];
const kStdErrPatterns = [kGhostPattern, kGhostCorruptPattern];

function suggestHint(
  logText: string,
  stderr?: string,
): string | undefined {
  // Check stderr for hints
  const stderrHint = kStdErrPatterns.find((errPattern) =>
    stderr?.match(errPattern.regex)
  );

  if (stderrHint) {
    return stderrHint.hint;
  } else {
    // Check the log file for hints
    const logHint = kLogOutputPatterns.find((logPattern) =>
      logText.match(logPattern.regex)
    );
    if (logHint) {
      return logHint.hint;
    } else {
      return undefined;
    }
  }
}
