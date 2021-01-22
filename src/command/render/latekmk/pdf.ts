/*
 * pdf.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { basename, dirname, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { ld } from "lodash/mod.ts";

import { message } from "../../../core/console.ts";
import { dirAndStem } from "../../../core/path.ts";

import {
  findPackages,
  hasTexLive,
  installPackages,
  updatePackages,
} from "./texlive.ts";
import { runBibEngine, runIndexEngine, runPdfEngine } from "./latex.ts";
import { LatexmkOptions } from "./latexmk.ts";

const kMissingFontLog = "missfont.log";

export async function generatePdf(mkOptions: LatexmkOptions) {
  const {
    input,
    engine: pdfEngine = { pdfEngine: "pdflatex" },
  } = mkOptions;

  const [dir, stem] = dirAndStem(input);

  if (!mkOptions.quiet) {
    message(`Creating PDF (${mkOptions.engine.pdfEngine})`, { bold: true });
  }

  // Determine whether we support automatic updated (TexLive is available)
  const allowUpdate = hasTexLive();
  mkOptions.autoInstall == mkOptions.autoInstall && allowUpdate;

  // The package Installer
  const packageInstaller = installPackageHandler();

  // Render the PDF, detecting whether any packages need to be installed
  let packagesUpdated = false;
  while (true) {
    const result = await runPdfEngine(mkOptions);

    // We'll consider it a failure if there is an error status or output is missing despite a success status
    // (PNAS Template may eat errors when missing packages exists)
    // See: https://github.com/yihui/tinytex/blob/6c0078f2c3c1319a48b71b61753f09c3ec079c0a/R/latex.R#L216
    if (
      result.code !== 0 ||
      result.code === 0 && !existsSync(result.output)
    ) {
      // Try auto-installing the packages
      if (existsSync(result.log) && mkOptions.autoInstall !== false) {
        if (!mkOptions.quiet) {
          message("Checking for missing packages", { bold: true });
        }

        // First be sure all packages are up to date
        if (!packagesUpdated) {
          await updatePackages(true, false, mkOptions.quiet);
          packagesUpdated = true;
        }

        // Install packages and retry (this will throw if packages fail to be installed)
        const packagesInstalled = await packageInstaller(
          result.log,
          mkOptions.quiet,
        );

        // If packages were installed, we should retry PDF generation, otherwise we should fail
        if (packagesInstalled) {
          continue;
        } else {
          // TODO: Print a nice Latex Error (the PDF generators do not write anything to stderr and stdout just contains progress)
          throw new Error(
            "Latex compilation failed (No packages were installed)",
          );
        }
      } else {
        // TODO: Print a nice Latex Error (the PDF generators do not write anything to stderr and stdout just contains progress)
        throw new Error(
          "Latex compilation failed (Missing log or no auto-install)",
        );
      }
    }
    // If we get here, we aren't installing packages (or we've already installed them)
    break;
  }

  // Signal whether we need to recompile b/c bibliography or index data has been created
  let recompilationRequired = false;

  // Generate the index
  const indexFile = join(dir, `${stem}.idx`);
  if (existsSync(indexFile)) {
    recompilationRequired = true;
    if (!mkOptions.quiet) {
      message("Making Index", { bold: true });
    }

    const result = await runIndexEngine(indexFile, mkOptions);
    if (result.code !== 0) {
      // TODO: Print a nice error (or confirm that makeindex prints something helpful)
      throw new Error(`Failed to generate index ${indexFile}`);
    }
  }

  // Generate bibliography (including potentially installing missing packages)
  // By default, we'll use citeproc which requires no additional processing,
  // but if the user would like to use natbib or biblatex, we do need additional
  // processing (including explicitly calling the processing tool)
  const bibCommand = mkOptions.engine.bibEngine == "natbib"
    ? "bibtex"
    : "biber";

  while (true) {
    // If biber, look for a bcf file, otherwise look for aux file
    const auxBibFile = bibCommand === "biber"
      ? join(dir, `${stem}.bcf`)
      : join(dir, `${stem}.aux`);
    const requiresProcessing = bibCommand === "biber"
      ? true
      : requiresBiblioGeneration(auxBibFile);

    if (existsSync(auxBibFile) && requiresProcessing) {
      if (!mkOptions.quiet) {
        message("Generating bibliography", { bold: true });
      }

      // If natbib, only use bibtex, otherwise, could use biber or bibtex
      recompilationRequired = true;
      const result = await runBibEngine(
        bibCommand,
        auxBibFile,
        mkOptions,
      );

      if (result.code !== 0 && mkOptions.autoInstall !== false) {
        // Biblio generation failed, see whether we should install
        // Find the missing packages
        const log = join(dir, `${stem}.blg`);

        if (existsSync(log)) {
          const logOutput = Deno.readTextFileSync(log);
          const match = logOutput.match(/.* open style file ([^ ]+).*/);

          if (match) {
            const file = match[1];
            const packagesInstalled = await packageInstaller(
              file,
              mkOptions.quiet,
            );
            if (packagesInstalled) {
              continue;
            } else {
              // TODO: Print a nice Latex Error (the PDF generators do not write anything to stderr and stdout just contains progress)
              throw new Error("Bibliography compilation failed");
            }
          }
        }
      }
    }
    break;
  }

  const minRuns = mkOptions.minRuns || 1;
  const maxRuns = mkOptions.maxRuns || 10;

  // If the user is explicitly requesting more than one run, be sure that we fulfill that request
  if (minRuns > 1) {
    recompilationRequired = true;
  }

  // Run the engine until the bibliography is fully resolved
  if (recompilationRequired) {
    let runCount = 0;
    while (true) {
      // If we've exceeded maximum runs break
      if (runCount >= maxRuns) {
        if (!mkOptions.quiet) {
          message(
            `Maximum number of runs (${maxRuns}) reached`,
            { bold: true },
          );
        }
        break;
      }

      if (!mkOptions.quiet) {
        message(
          `Resolving citations and index (run ${runCount + 1})`,
          { bold: true },
        );
      }

      const result = await runPdfEngine(mkOptions);
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

  // cleanup if requested
  if (mkOptions.clean) {
    cleanup(input, pdfEngine.pdfEngineOpts || []);
  }

  if (!mkOptions.quiet) {
    message("");
  }
}

function installPackageHandler(): (
  log: string,
  quiet?: boolean,
) => Promise<boolean> {
  let lastPkgs: string[] = [];
  return async (log: string, quiet?: boolean) => {
    const pkgs = await findMissingPackages(log, quiet);

    // See whether we just tried to install the same packages or
    // if there are no packages detected to install
    // (if so, just give up as we can't suceed)
    const difference = ld.difference(pkgs, lastPkgs);
    if (difference.length > 0) {
      // Attempt to install the packages
      await installPackages(pkgs, quiet);

      // Note that we tried to install these packages
      lastPkgs = pkgs;

      // Try running the engine again now that we've installed packages
      return true;
    } else {
      // We have already tried installing these packages, don't install the packages
      return false;
    }
  };
}

async function findMissingPackages(
  logFile: string,
  quiet?: boolean,
): Promise<string[]> {
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
  const uniqueTerms = ld.uniq(searchTerms);
  if (uniqueTerms.length > 0) {
    if (!quiet) {
      message(
        `Finding ${
          uniqueTerms.length == 1 ? "package" : "packages"
        } for ${uniqueTerms.length} ${
          uniqueTerms.length == 1 ? "item" : "items"
        }`,
        { bold: true },
      );
    }
    return await findPackages(uniqueTerms, quiet);
  } else {
    return [];
  }
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

function cleanup(input: string, pdfEngineOpts: string[]) {
  const [inputDir, inputStem] = dirAndStem(input);
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
  ].map((aux) => join(inputDir, auxFile(inputStem, aux)));

  // Also cleanup any missfont.log file
  auxFiles.push(join(inputDir, kMissingFontLog));

  auxFiles.forEach((auxFile) => {
    if (existsSync(auxFile)) {
      Deno.removeSync(auxFile);
    }
  });
}
