/*
 * quarto-latexmk.ts
 *
 * Copyright (C) 2021-2024 Posit Software, PBC
 */
import { debug } from "../../../deno_ral/log.ts";
import { Command, Option } from "npm:clipanion";
import { isNumber } from "npm:typanion";

import {
  addLoggingOptions,
} from "../../../core/log.ts";
import { LatexmkOptions } from "./types.ts";
import { generatePdf } from "./pdf.ts";
import {
  kExeDescription,
  kExeName,
  kExeVersion,
} from "./quarto-latexmk-metadata.ts";
import { mainRunner } from "../../../core/main.ts";

interface EngineOpts {
  pdf: string[];
  index: string[];
  tlmgr: string[];
}

export abstract class PDFCommand extends Command {
  input = Option.String();

  ['bib-engine'] = Option.String('--bib-engine', {description: "The bibliography engine to use"});

  ['index-engine'] = Option.String('--index-engine', {description: "The index engine to use"});
  ['index-engine-opt'] = Option.Array('--index-engine', {
    description: "Options passed to the index engine." +
        "Can be used multiple times - values will be passed in the order they appear in the command." +
        "These must be specified using an '='."
  });

  max = Option.String("--max", {
    description: "The maximum number of iterations",
    validator: isNumber(),
  });

  min = Option.String("--min", {
    description: "The minimum number of iterations",
    validator: isNumber(),
  });

  ['no-auto-install'] = Option.Boolean('--no-auto-install', {description: "Disable automatic package installation"});
  ['no-auto-mk'] = Option.Boolean('--no-auto-mk', {description: "Disable the pdf generation loop"});
  ['no-clean'] = Option.Boolean('--no-clean', {description: "Don't clean intermediaries"});

  outputDir = Option.String("--output-dir", { description: "The output directory" });

  ['pdf-engine'] = Option.String('--pdf-engine', {description: "The PDF engine to use"});
  ['pdf-engine-opt'] = Option.Array('--pdf-engine-opt', {
    description: "Options passed to the pdf engine." +
        "Can be used multiple times - values will be passed in the order they appear in the command." +
        "These must be specified using an '='."
  });

  ['tlmgr-opt'] = Option.Array('--tlmgr-opt', {
    description: "Options passed to the tlmgr engine." +
        "Can be used multiple times - values will be passed in the order they appear in the command." +
        "These must be specified using an '='."
  });

  async execute() {
    const engineOpts: EngineOpts = {
      index: this['index-engine-opt'],
      pdf: this['pdf-engine-opt'],
      tlmgr: this['tlmgr-opt'],
    };
    const latexmkOptions = mkOptions(
        this.input,
        this,
        engineOpts,
    );
    await generatePdf(latexmkOptions);
  }
}

const commands = [
    PDFCommand,
];

class PDFCli extends Cli {
  constructor() {
    super({
      binaryLabel: kExeDescription,
      binaryName: kExeName,
      binaryVersion: kExeVersion,
    });

    [
      ...commands,
      Builtins.HelpCommand

      // TODO: shell completion is not yet supported by clipanion
      //   see https://github.com/arcanis/clipanion/pull/89
      // Builtins.CompletionsCommand
    ].forEach((command) => {
      addLoggingOptions(command);
      this.register(command);
    });
  }
}

if (import.meta.main) {
  await mainRunner(async () => {
    const pdf = new PDFCli();
    await pdf.runExit(Deno.args);
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
