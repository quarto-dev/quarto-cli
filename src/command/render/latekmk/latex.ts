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

import { PdfEngine } from "../../../config/pdf.ts";
import { PackageManager } from "./pkgmgr.ts";
import { kPdfGenerateMessageOptions } from "./pdf.ts";

interface LatexCommandReponse {
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
  } catch (e) {
    return false;
  }
}

// Runs the Pdf engine
export async function runPdfEngine(
  input: string,
  engine: PdfEngine,
  outputDir?: string,
  pkgMgr?: PackageManager,
  quiet?: boolean,
): Promise<LatexCommandReponse> {
  // Input and log paths
  const [dir, stem] = dirAndStem(input);
  const output = join(outputDir || dir, `${stem}.pdf`);
  const log = join(outputDir || dir, `${stem}.log`);

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
    pkgMgr,
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
  const [dir, stem] = dirAndStem(input);
  const log = join(dir, `${stem}.ilg`);

  // Clean any log file from previous runs
  if (existsSync(log)) {
    Deno.removeSync(log);
  }

  const result = await runLatexCommand(
    engine || "makeindex",
    [...(args || []), input],
    pkgMgr,
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
    pkgMgr,
    quiet,
  );
  return {
    result,
    log,
  };
}

async function runLatexCommand(
  latexCmd: string,
  args: string[],
  pkMgr?: PackageManager,
  quiet?: boolean,
): Promise<ProcessResult> {
  const runOptions: Deno.RunOptions = {
    cmd: [latexCmd, ...args],
    stdout: "piped",
    stderr: "piped",
  };

  const stdoutHandler = (data: Uint8Array) => {
    if (!quiet) {
      Deno.stderr.writeSync(data);
    }
  };

  const runCmd = async () => {
    const result = await execProcess(runOptions, undefined, stdoutHandler);
    if (!quiet && result.stderr) {
      message(result.stderr);
    }
    return result;
  };

  try {
    return await runCmd();
  } catch (e) {
    if (e.name === "NotFound" && pkMgr && pkMgr.autoInstall) {
      if (!quiet) {
        message(
          `Command ${latexCmd} not found. Attempting to install`,
          kPdfGenerateMessageOptions,
        );
      }

      // if not, install it
      await pkMgr.installPackages([latexCmd]);

      // Try running the command again
      return await runCmd();
    } else {
      const tex = await hasLatexDistribution();
      if (!tex) {
        message(
          "No TeX installation was detected. Please install TinyTex (https://yihui.name/tinytex/) or another TeX distribution and try again",
        );
        return Promise.reject();
      } else {
        message(
          `Command ${latexCmd} not found.`,
        );
      }

      return Promise.reject();
    }
  }
}
