/*
 * latex.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { basename, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { message } from "../../../core/console.ts";
import { dirAndStem } from "../../../core/path.ts";
import { execProcess, ProcessResult } from "../../../core/process.ts";

import { installPackages } from "./texlive.ts";
import { LatexmkOptions } from "./latexmk.ts";

interface PdfEngineResult {
  code: number;
  output: string;
  log: string;
}

interface BibEngineResult {
  code: number;
  log: string;
}

// Runs the Pdf engine
export async function runPdfEngine(
  options: LatexmkOptions,
): Promise<PdfEngineResult> {
  // Input and log paths
  const [dir, stem] = dirAndStem(options.input);
  const output = join(dir, `${stem}.pdf`);
  const log = join(dir, `${stem}.log`);

  // Clean any log file from previous runs
  if (existsSync(log)) {
    Deno.removeSync(log);
  }

  // build pdf engine command line
  const args = ["-interaction=batchmode", "-halt-on-error"];

  // pdf engine opts
  if (options.engine.pdfEngineOpts) {
    args.push(...options.engine.pdfEngineOpts);
  }

  // input file
  args.push(basename(options.input));

  // Run the command
  const result = await runLatexCommand(
    options.engine.pdfEngine,
    args,
    options.autoInstall,
  );

  // Success, return result
  return {
    code: result.code,
    output,
    log,
  };
}

// Run the index generation engine (currently hard coded to makeindex)
export async function runIndexEngine(input: string, options: LatexmkOptions) {
  return await runLatexCommand(
    "makeindex",
    [input],
    options.autoInstall,
    options.quiet,
  );
}

// Runs the bibengine to process citations
export async function runBibEngine(
  engine: string,
  input: string,
  options: LatexmkOptions,
): Promise<BibEngineResult> {
  const result = await runLatexCommand(
    engine,
    [input],
    options.autoInstall,
    options.quiet,
  );
  const [dir, stem] = dirAndStem(input);
  const log = join(dir, `${stem}.blg`);
  return {
    code: result.code,
    log,
  };
}

async function runLatexCommand(
  latexCmd: string,
  args: string[],
  autoInstall?: boolean,
  quiet?: boolean,
): Promise<ProcessResult> {
  const runOptions: Deno.RunOptions = {
    cmd: [latexCmd, ...args],
    stdout: "piped",
    stderr: quiet ? "piped" : undefined,
  };

  const stdoutHandler = (data: Uint8Array) => {
    if (!quiet) {
      Deno.stderr.writeSync(data);
    }
  };

  try {
    return await execProcess(runOptions, undefined, stdoutHandler);
  } catch (e) {
    if (e.name === "NotFound" && autoInstall) {
      if (!quiet) {
        message(`Command ${latexCmd} not found. Attempting to install`);
      }

      // if not, install it
      await installPackages([latexCmd], quiet);

      // Try running the command again
      return await execProcess(runOptions, undefined, stdoutHandler);
    } else {
      throw e;
    }
  }
}
