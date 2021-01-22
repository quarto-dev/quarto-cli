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
import { PdfEngine } from "../../../config/pdf.ts";
import { kLatexMkMessageOptions } from "./latexmk.ts";

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
  input: string,
  engine: PdfEngine,
  outputDir?: string,
  autoinstall?: boolean,
  quiet?: boolean,
): Promise<PdfEngineResult> {
  // By default, automatically attempt to install a missing command
  autoinstall = autoinstall || true;

  // Input and log paths
  const [dir, stem] = dirAndStem(input);
  const output = join(outputDir || dir, `${stem}.pdf`);
  const log = join(outputDir || dir, `${stem}.log`);

  // Clean any log file from previous runs
  if (existsSync(log)) {
    Deno.removeSync(log);
  }

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
    autoinstall,
    quiet,
  );

  // Success, return result
  return {
    code: result.code,
    output,
    log,
  };
}

// Run the index generation engine (currently hard coded to makeindex)
export async function runIndexEngine(
  input: string,
  engine?: string,
  args?: string[],
  autoinstall?: boolean,
  quiet?: boolean,
) {
  return await runLatexCommand(
    engine || "makeindex",
    [...(args || []), input],
    autoinstall,
    quiet,
  );
}

// Runs the bibengine to process citations
export async function runBibEngine(
  engine: string,
  input: string,
  autoinstall?: boolean,
  quiet?: boolean,
): Promise<BibEngineResult> {
  const result = await runLatexCommand(
    engine,
    [input],
    autoinstall,
    quiet,
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
        message(
          `Command ${latexCmd} not found. Attempting to install`,
          kLatexMkMessageOptions,
        );
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
