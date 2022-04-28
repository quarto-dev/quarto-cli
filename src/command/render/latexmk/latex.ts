/*
 * latex.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { basename, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { error, info } from "log/mod.ts";

import { PdfEngine } from "../../../config/types.ts";

import { dirAndStem } from "../../../core/path.ts";
import { execProcess, ProcessResult } from "../../../core/process.ts";

import { PackageManager } from "./pkgmgr.ts";
import {
  kLatexBodyMessageOptions,
  kLatexHeaderMessageOptions,
} from "./types.ts";

export interface LatexCommandReponse {
  log: string;
  result: ProcessResult;
  output?: string;
}

export async function hasLatexDistribution() {
  try {
    const result = await execProcess({
      cmd: ["pdftex", "--version"],
      stdout: "piped",
      stderr: "piped",
    });
    return result.code === 0;
  } catch {
    return false;
  }
}

// Runs the Pdf engine
export async function runPdfEngine(
  input: string,
  engine: PdfEngine,
  outputDir?: string,
  texInputDirs?: string[],
  pkgMgr?: PackageManager,
  quiet?: boolean,
): Promise<LatexCommandReponse> {
  // Input and log paths
  const [cwd, stem] = dirAndStem(input);
  const targetDir = outputDir ? join(cwd, outputDir) : cwd;
  const output = join(targetDir, `${stem}.pdf`);
  const log = join(targetDir, `${stem}.log`);

  // Clean any log file or output from previous runs
  [log, output].forEach((file) => {
    if (existsSync(file)) {
      Deno.removeSync(file);
    }
  });

  // build pdf engine command line
  const args = ["-interaction=batchmode", "-halt-on-error"];

  // output directory
  if (outputDir !== undefined) {
    args.push(`-output-directory=${outputDir}`);
  }

  // pdf engine opts
  if (engine.pdfEngineOpts) {
    args.push(...engine.pdfEngineOpts);
  }

  // input file
  args.push(basename(input));

  // Run the command
  const result = await runLatexCommand(
    engine.pdfEngine,
    args,
    {
      pkgMgr,
      cwd,
      texInputDirs,
    },
    quiet,
  );

  // Success, return result
  return {
    result,
    output,
    log,
  };
}

// Run the index generation engine (currently hard coded to makeindex)
export async function runIndexEngine(
  input: string,
  engine?: string,
  args?: string[],
  pkgMgr?: PackageManager,
  quiet?: boolean,
) {
  const [cwd, stem] = dirAndStem(input);
  const log = join(cwd, `${stem}.ilg`);

  // Clean any log file from previous runs
  if (existsSync(log)) {
    Deno.removeSync(log);
  }

  const result = await runLatexCommand(
    engine || "makeindex",
    [...(args || []), basename(input)],
    {
      cwd,
      pkgMgr,
    },
    quiet,
  );

  return {
    result,
    log,
  };
}

// Runs the bibengine to process citations
export async function runBibEngine(
  engine: string,
  input: string,
  cwd: string,
  pkgMgr?: PackageManager,
  quiet?: boolean,
): Promise<LatexCommandReponse> {
  const [dir, stem] = dirAndStem(input);
  const log = join(dir, `${stem}.blg`);

  // Clean any log file from previous runs
  if (existsSync(log)) {
    Deno.removeSync(log);
  }

  const result = await runLatexCommand(
    engine,
    [input],
    {
      pkgMgr,
      cwd,
    },
    quiet,
  );
  return {
    result,
    log,
  };
}

export interface LatexCommandContext {
  pkgMgr?: PackageManager;
  cwd?: string;
  texInputDirs?: string[];
}

async function runLatexCommand(
  latexCmd: string,
  args: string[],
  context: LatexCommandContext,
  quiet?: boolean,
): Promise<ProcessResult> {
  const runOptions: Deno.RunOptions = {
    cmd: [latexCmd, ...args],
    stdout: "piped",
    stderr: "piped",
  };

  // Set the working directory
  if (context.cwd) {
    runOptions.cwd = context.cwd;
  }

  // Add a tex search path
  // The // means that TeX programs will search recursively in that folder;
  // the trailing colon means "append the standard value of TEXINPUTS" (which you don't need to provide).
  if (context.texInputDirs) {
    // note this  //
    runOptions.env = runOptions.env || {};
    runOptions.env["TEXINPUTS"] = `${context.texInputDirs.join(";")};`;
  }

  // Run the command
  const runCmd = async () => {
    const result = await execProcess(runOptions, undefined, "stdout>stderr");
    if (!quiet && result.stderr) {
      info(result.stderr, kLatexBodyMessageOptions);
    }
    return result;
  };

  try {
    // Try running the command
    return await runCmd();
  } catch (_e) {
    // First confirm that there is a TeX installation available
    const tex = await hasLatexDistribution();
    if (!tex) {
      info(
        "\nNo TeX installation was detected.\n\nPlease run 'quarto tools install tinytex' to install TinyTex.\nIf you prefer, you may install TexLive or another TeX distribution.\n",
      );
      return Promise.reject();
    } else if (context.pkgMgr && context.pkgMgr.autoInstall) {
      // If the command itself can't be found, try installing the command
      // if auto installation is enabled
      if (!quiet) {
        info(
          `command ${latexCmd} not found, attempting install`,
          kLatexHeaderMessageOptions,
        );
      }

      // Search for a package for this command
      const packageForCommand = await context.pkgMgr.searchPackages([latexCmd]);
      if (packageForCommand) {
        // try to install it
        await context.pkgMgr.installPackages(packagesForCommand(latexCmd));
      }
      // Try running the command again
      return await runCmd();
    } else {
      // Some other error has occurred
      error(
        `Error executing ${latexCmd}`,
        kLatexHeaderMessageOptions,
      );

      return Promise.reject();
    }
  }
}

// Convert any commands to their
function packagesForCommand(cmd: string): string[] {
  if (cmd === "texindy") {
    return ["xindy"];
  } else {
    return [cmd];
  }
}
