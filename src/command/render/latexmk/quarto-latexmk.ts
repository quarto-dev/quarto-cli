import { onSignal } from "signal/mod.ts";
import { existsSync } from "fs/mod.ts";
import { debug } from "log/mod.ts";
import {
  Command,
  CompletionsCommand,
  HelpCommand,
} from "cliffy/command/mod.ts";
import { parse } from "flags/mod.ts";

import {
  appendLogOptions,
  cleanupLogger,
  initializeLogger,
  logError,
  logOptions,
} from "../../../core/log.ts";
import { LatexmkOptions } from "./latexmk.ts";
import { generatePdf } from "./pdf.ts";

const kVersion = "1.0";

export async function pdf(args: string[]) {
  const pdfCommand = new Command()
    .name("quarto-pdf")
    .arguments("<input:string>")
    .version(kVersion)
    .description("Quarto PDF engine")
    .option(
      "--pdf-engine <engine>",
      "The PDF engine to use",
    )
    .option(
      "--pdf-engine-opts <optionsfile:string>",
      "File containing options passed to the pdf engine (one arg per line)",
    )
    .option(
      "--index-engine <engine>",
      "The index engine to use",
    )
    .option(
      "--index-engine-opts <optionsfile:string>",
      "File containing options passed to the index engine (one arg per line)",
    )
    .option(
      "--bib-engine <engine>",
      "The bibliography engine to use",
    )
    .option(
      "--no-auto-install",
      "Disable automatic package installation",
    )
    .option(
      "--tlmgr-opts <optionsfile:string>",
      "File containing options passed to the tlmgr engine (one arg per line)",
    )
    .option(
      "--no-auto-mk",
      "Disable the pdf generation loop",
    )
    .option(
      "--min <min:number>",
      "The minimum number of iterations",
    )
    .option(
      "--max <max:number>",
      "The maximum number of iterations",
    )
    .option("--output-dir <directory>", "The output directory")
    .option("--no-clean", "Don't clean intermediaries")
    .throwErrors()
    .action(async (options: unknown, input: string) => {
      const latexmkOptions = mkOptions(
        input,
        options as Record<string, unknown>,
      );
      await generatePdf(latexmkOptions);
    });

  await appendLogOptions(pdfCommand)
    .command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand()).hidden()
    .parse(args);
}

if (import.meta.main) {
  try {
    // Parse the raw args to read globals and initialize logging
    //    const args = parse(Deno.args);
    const args = parse(Deno.args);
    await initializeLogger(logOptions(args));

    await pdf(Deno.args);
    // install termination signal handlers
    onSignal(Deno.Signal.SIGINT, cleanup);
    onSignal(Deno.Signal.SIGTERM, cleanup);
  } catch (e) {
    if (e) {
      logError(e);
    }
  } finally {
    cleanup();
  }
}

function mkOptions(
  input: string,
  options: Record<string, unknown>,
): LatexmkOptions {
  const engine = {
    pdfEngine: options.pdfEngine as string || "pdflatex",
    pdfEngineOpts: readOptionsFile(options.pdfEngineOpts as string),
    bibEngine: bibEngine(options.bibEngine as string) || "biblatex",
    indexEngine: options.indexEngine as string || "makeindex",
    indexEngineOpts: readOptionsFile(options.indexEngineOpts as string),
    tlmgrOpts: readOptionsFile(options.tlmgrOpts as string),
  };

  const latexMkOptions = {
    input,
    engine,
    autoInstall: options.autoInstall as boolean,
    autoMk: options.autoMk as boolean,
    minRuns: options.min as number,
    maxRuns: options.max as number,
    outputDir: options.outputDir as string,
    clean: options.clean as boolean,
  };

  // Debug message that show engine configuration (set --log-level debug to view)
  debug(() => {
    return JSON.stringify(latexMkOptions, undefined, 2);
  });

  return latexMkOptions;
}

function readOptionsFile(file?: string): string[] {
  const commands: string[] = [];
  if (file && existsSync(file)) {
    const contents = Deno.readTextFileSync(file);
    const lines = contents.split(/\r?\n/);
    lines.forEach((line) => commands.push(line));
  }
  return commands;
}

function bibEngine(bibEngine?: string): "biblatex" | "natbib" {
  if (bibEngine?.toLowerCase() === "natbib") {
    return "natbib";
  } else {
    return "biblatex";
  }
}

function cleanup() {
  cleanupLogger();
  Deno.exit(1);
}
