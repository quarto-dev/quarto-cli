/*
 * pdf.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { basename, dirname, extname, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { ld } from "lodash/mod.ts";

import { message } from "../../../core/console.ts";
import { dirAndStem } from "../../../core/path.ts";
import { PdfEngine } from "../../../config/pdf.ts";

import { hasTexLive } from "./texlive.ts";
import { runBibEngine, runIndexEngine, runPdfEngine } from "./latex.ts";
import { kLatexMkMessageOptions, LatexmkOptions } from "./latexmk.ts";
import { PackageManager, packageManager } from "./pkgmgr.ts";

const kMissingFontLog = "missfont.log";

export async function generatePdf(mkOptions: LatexmkOptions) {
  if (!mkOptions.quiet) {
    message(
      `Creating PDF (${mkOptions.engine.pdfEngine})`,
      kLatexMkMessageOptions,
    );
  }

  // Get the working directory and file name stem
  const [workingDir, inputStem] = mkOptions.outputDir
    ? [
      mkOptions.outputDir,
      basename(mkOptions.input, extname(mkOptions.input)),
    ]
    : dirAndStem(mkOptions.input);

  // Ensure that working directory exists
  if (!existsSync(workingDir)) {
    Deno.mkdirSync(workingDir);
  }

  // Determine whether we support automatic updated (TexLive is available)
  const allowUpdate = hasTexLive();
  mkOptions.autoInstall == mkOptions.autoInstall && allowUpdate;

  // The package manager used to find and install packages
  const pkgMgr = packageManager(mkOptions);

  // Render the PDF, detecting whether any packages need to be installed
  await initialCompileLatex(
    mkOptions.input,
    mkOptions.engine,
    pkgMgr,
    mkOptions.outputDir,
    mkOptions.quiet,
  );

  // Generate the index information, if needed
  const indexCreated = await makeIndexIntermediates(
    workingDir,
    inputStem,
    pkgMgr,
    mkOptions.engine.indexEngine,
    mkOptions.engine.indexEngineOpts,
    mkOptions.quiet,
  );

  // Generate the bibliography intermediaries
  const bibliographyCreated = await makeBibliographyIntermediates(
    workingDir,
    inputStem,
    mkOptions.engine.bibEngine || "citeproc",
    pkgMgr,
    mkOptions.quiet,
  );

  // Recompile the Latex if required
  const hasMinimumRuns = mkOptions.minRuns && mkOptions.minRuns > 1;
  if (indexCreated || bibliographyCreated || hasMinimumRuns) {
    await recompileLatexUntilComplete(
      mkOptions.input,
      mkOptions.engine,
      pkgMgr,
      mkOptions.minRuns || 1,
      mkOptions.maxRuns || 10,
      mkOptions.outputDir,
      mkOptions.autoInstall,
      mkOptions.quiet,
    );
  }

  // cleanup if requested
  if (mkOptions.clean) {
    cleanup(workingDir, inputStem);
  }

  if (!mkOptions.quiet) {
    message("");
  }
}

// The first pass compilation of the latex with the ability to discover
// missing packages (and subsequently retrying the compilation)
async function initialCompileLatex(
  input: string,
  engine: PdfEngine,
  pkgMgr: PackageManager,
  outputDir?: string,
  quiet?: boolean,
) {
  let packagesUpdated = false;
  while (true) {
    const result = await runPdfEngine(
      input,
      engine,
      outputDir,
      pkgMgr,
      quiet,
    );

    // We'll consider it a failure if there is an error status or output is missing despite a success status
    // (PNAS Template may eat errors when missing packages exists)
    // See: https://github.com/yihui/tinytex/blob/6c0078f2c3c1319a48b71b61753f09c3ec079c0a/R/latex.R#L216
    if (
      result.code !== 0 ||
      result.code === 0 && !existsSync(result.output)
    ) {
      // Try auto-installing the packages
      if (existsSync(result.log) && pkgMgr.autoInstall) {
        // First be sure all packages are up to date
        if (!packagesUpdated) {
          if (!quiet) {
            message("Updating existing packages", kLatexMkMessageOptions);
          }
          await pkgMgr.updatePackages(true, false);
          packagesUpdated = true;
        }

        if (await findAndInstallPackages(result.log, pkgMgr, quiet)) {
          continue;
        } else {
          throw new Error(
            "Latex compilation failed (Missing log or no auto-install)",
          );
        }
      }
    }
    // If we get here, we aren't installing packages (or we've already installed them)
    break;
  }
}

async function makeIndexIntermediates(
  dir: string,
  stem: string,
  pkgMgr: PackageManager,
  engine?: string,
  args?: string[],
  quiet?: boolean,
) {
  // If there is an idx file, we need to run makeindex to create the index data
  const indexFile = join(dir, `${stem}.idx`);
  if (existsSync(indexFile)) {
    if (!quiet) {
      message("Making Index", kLatexMkMessageOptions);
    }

    // Make the index
    const result = await runIndexEngine(
      indexFile,
      engine,
      args,
      pkgMgr,
      quiet,
    );

    // Indexing Failed
    if (result.code !== 0) {
      // TODO: Print a nice error (or confirm that makeindex prints something helpful)
      throw new Error(`Failed to generate index ${indexFile}`);
    }
    return true;
  } else {
    return false;
  }
}

async function makeBibliographyIntermediates(
  dir: string,
  stem: string,
  engine: string,
  pkgMgr: PackageManager,
  quiet?: boolean,
) {
  // Generate bibliography (including potentially installing missing packages)
  // By default, we'll use citeproc which requires no additional processing,
  // but if the user would like to use natbib or biblatex, we do need additional
  // processing (including explicitly calling the processing tool)
  const bibCommand = engine == "natbib" ? "bibtex" : "biber";

  while (true) {
    // If biber, look for a bcf file, otherwise look for aux file
    const auxBibFile = bibCommand === "biber"
      ? join(dir, `${stem}.bcf`)
      : join(dir, `${stem}.aux`);
    const requiresProcessing = bibCommand === "biber"
      ? true
      : requiresBiblioGeneration(auxBibFile);

    if (existsSync(auxBibFile) && requiresProcessing) {
      if (!quiet) {
        message("Generating bibliography", kLatexMkMessageOptions);
      }

      // If natbib, only use bibtex, otherwise, could use biber or bibtex
      const result = await runBibEngine(
        bibCommand,
        auxBibFile,
        pkgMgr,
        quiet,
      );

      if (result.code !== 0 && pkgMgr.autoInstall) {
        // Biblio generation failed, see whether we should install anything to try to resolve
        // Find the missing packages
        const log = join(dir, `${stem}.blg`);

        if (existsSync(log)) {
          const logOutput = Deno.readTextFileSync(log);
          const match = logOutput.match(/.* open style file ([^ ]+).*/);

          if (match) {
            const file = match[1];
            if (await findAndInstallPackages(file, pkgMgr, quiet)) {
              continue;
            } else {
              // TODO: Print a nice Latex Error (the PDF generators do not write anything to stderr and stdout just contains progress)
              throw new Error("Bibliography compilation failed");
            }
          }
        }
      }
      return true;
    }
    return false;
  }
}

async function findAndInstallPackages(
  file: string,
  pkgMgr: PackageManager,
  quiet?: boolean,
) {
  if (!quiet) {
    message("Checking for missing packages", kLatexMkMessageOptions);
  }

  if (existsSync(file)) {
    const searchTerms = findSearchTermsInLog(file);
    if (searchTerms.length > 0) {
      const packages = await pkgMgr.searchPackages(searchTerms);
      if (packages.length > 0) {
        const packagesInstalled = await pkgMgr.installPackages(
          packages,
        );
        if (packagesInstalled) {
          // Try again
          return true;
        } else {
          throw new Error(
            "No packages installed",
          );
        }
      } else {
        throw new Error(
          "No matching packages found",
        );
      }
    } else {
      throw new Error(
        "No package errors",
      );
    }
  }
  return false;
}

async function recompileLatexUntilComplete(
  input: string,
  engine: PdfEngine,
  pkgMgr: PackageManager,
  minRuns: number,
  maxRuns: number,
  outputDir?: string,
  autoinstall?: boolean,
  quiet?: boolean,
) {
  // Run the engine until the bibliography is fully resolved
  let runCount = 0;
  while (true) {
    // If we've exceeded maximum runs break
    if (runCount >= maxRuns) {
      if (!quiet) {
        message(
          `Maximum number of runs (${maxRuns}) reached`,
          kLatexMkMessageOptions,
        );
      }
      break;
    }

    if (!quiet) {
      message(
        `Resolving citations and index (run ${runCount + 1})`,
        kLatexMkMessageOptions,
      );
    }

    const result = await runPdfEngine(
      input,
      engine,
      outputDir,
      pkgMgr,
      quiet,
    );
    runCount = runCount + 1;
    // If we haven't reached the minimum or the bibliography still needs to be rerun
    // go again.
    if (
      existsSync(result.log) && needsRecompilation(result.log) ||
      runCount < minRuns
    ) {
      continue;
    }
    break;
  }
}

function findSearchTermsInLog(
  logFile: string,
): string[] {
  const searchTerms: string[] = [];

  // Look in the log file for any missing packages or fonts
  if (existsSync(logFile)) {
    const logFileText = Deno.readTextFileSync(logFile);
    const packageSearchTerms = findFiles(logFileText);
    searchTerms.push(...packageSearchTerms);
  }

  // Look in the missing font file for any missing fonts
  const missFontLog = join(dirname(logFile), kMissingFontLog);
  if (existsSync(missFontLog)) {
    const missFontLogText = Deno.readTextFileSync(missFontLog);
    const fontSearchTerms = findFonts(missFontLogText);
    searchTerms.push(...fontSearchTerms);
  }

  // Search TexLive for missing packages and fonts
  return ld.uniq(searchTerms);
}

const formatFontFilter = (match: string, text: string) => {
  const base = basename(match);
  return fontExt(base);
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
    filter: (match: string, text: string) => {
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

  { regex: /.*! LaTeX Error: File `([^']+)' not found.*/g },
  { regex: /.* file ['`]?([^' ]+)'? not found.*/g },
  { regex: /.*the language definition file ([^ ]+) .*/g },
  { regex: /.* \\(file ([^)]+)\\): cannot open .*/g },
  { regex: /.*file `([^']+)' .*is missing.*/g },
  { regex: /.*! CTeX fontset `([^']+)' is unavailable.*/g },
  { regex: /.*: ([^:]+): command not found.*/g },
  { regex: /.*! I can't find file `([^']+)'.*/g },
];

function fontExt(font: string): string {
  return `${font}(-(Bold|Italic|Regular).*)?[.](tfm|afm|mf|otf|ttf)`;
}

function findFiles(logFileText: string): string[] {
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

function findFonts(missFontLogText: string): string[] {
  const toInstall: string[] = [];
  const lines = missFontLogText.split(/\r?\n/);
  lines.forEach((line) => {
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

function needsRecompilation(log: string, quiet?: boolean) {
  if (existsSync(log)) {
    const logContents = Deno.readTextFileSync(log);
    return logContents.match(
      /(Rerun to get |Please \(re\)run | Rerun LaTeX\.)/,
    );
  }
  return false;
}

function requiresBiblioGeneration(auxFile: string) {
  const auxData = Deno.readTextFileSync(auxFile);
  if (auxData) {
    return auxData.match(/^\\(bibdata|citation|bibstyle)\{/m);
  } else {
    return false;
  }
}

function auxFile(stem: string, ext: string) {
  return `${stem}.${ext}`;
}

function cleanup(workingDir: string, stem: string) {
  const auxFiles = [
    "log",
    "idx",
    "aux",
    "bcf",
    "blg",
    "bbl",
    "fls",
    "out",
    "lof",
    "lot",
    "toc",
    "nav",
    "snm",
    "vrb",
    "ilg",
    "ind",
    "xwm",
    "brf",
    "run.xml",
  ].map((aux) => join(workingDir, auxFile(stem, aux)));

  // Also cleanup any missfont.log file
  auxFiles.push(join(workingDir, kMissingFontLog));

  auxFiles.forEach((auxFile) => {
    if (existsSync(auxFile)) {
      Deno.removeSync(auxFile);
    }
  });
}
