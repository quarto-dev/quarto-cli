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
import { LatexmkOptions } from "./types.ts";
import { generatePdf } from "./pdf.ts";
import {
  kExeDescription,
  kExeName,
  kExeVersion,
} from "./quarto-latexmk-metadata.ts";
import { exitWithCleanup } from "../../../core/cleanup.ts";
import { mainRunner } from "../../../core/main.ts";

interface EngineOpts {
  pdf: string[];
  index: string[];
  tlmgr: string[];
}

function parseOpts(args: string[]): [string[], EngineOpts] {
  const pdfOpts = parseEngineFlags("pdf-engine-opt", args);
  const indexOpts = parseEngineFlags("index-engine-opt", pdfOpts.resultArgs);
  const tlmgrOpts = parseEngineFlags("tlmgr-opt", indexOpts.resultArgs);
  return [
    tlmgrOpts.resultArgs,
    {
      pdf: pdfOpts.values,
      index: indexOpts.values,
      tlmgr: tlmgrOpts.values,
    },
  ];
}

function parseEngineFlags(optFlag: string, args: string[]) {
  const values = [];
  const resultArgs = [];

  for (const arg of args) {
    if (arg.startsWith(`--${optFlag}=`)) {
      const value = arg.split("=")[1];
      values.push(value);
    } else {
      resultArgs.push(arg);
    }
  }
  return { values, resultArgs };
}

export async function pdf(args: string[]) {
  // Parse any of the option flags
  const [parsedArgs, engineOpts] = parseOpts(args);

  const pdfCommand = new Command()
    .name(kExeName)
    .arguments("<input:string>")
    .version(kExeVersion + "\n")
    .description(kExeDescription)
    .option(
      "--pdf-engine <engine>",
      "The PDF engine to use",
    )
    .option(
      "--pdf-engine-opt=<optionsfile:string>",
      "Options passed to the pdf engine. Can be used multiple times - values will be passed in the order they appear in the command. These must be specified using an '='.",
    )
    .option(
      "--index-engine <engine>",
      "The index engine to use",
    )
    .option(
      "--index-engine-opt=<optionsfile:string>",
      "Options passed to the index engine. Can be used multiple times - values will be passed in the order they appear in the command. These must be specified using an '='.",
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
      "--tlmgr-opt=<optionsfile:string>",
      "Options passed to the tlmgr engine. Can be used multiple times - values will be passed in the order they appear in the command. These must be specified using an '='.",
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
        engineOpts,
      );
      await generatePdf(latexmkOptions);
    });

  await appendLogOptions(pdfCommand)
    .command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand()).hidden()
    .parse(parsedArgs);
}

if (import.meta.main) {
  await mainRunner(async () => {
    await pdf(Deno.args);
  });
}

function mkOptions(
  input: string,
  options: Record<string, unknown>,
  engineOpts: EngineOpts,
): LatexmkOptions {
  const engine = {
    pdfEngine: options.pdfEngine as string || "pdflatex",
    pdfEngineOpts: engineOpts.pdf,
    bibEngine: bibEngine(options.bibEngine as string) || "biblatex",
    indexEngine: options.indexEngine as string || "makeindex",
    indexEngineOpts: engineOpts.index,
    tlmgrOpts: engineOpts.tlmgr,
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

function bibEngine(bibEngine?: string): "biblatex" | "natbib" {
  if (bibEngine?.toLowerCase() === "natbib") {
    return "natbib";
  } else {
    return "biblatex";
  }
}
