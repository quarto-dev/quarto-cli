/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { applyCascade, isArray, isNumber, isString, makeValidator } from "npm:typanion";

import { dirname, relative, isAbsolute, SEP_PATTERN } from "../../deno_ral/path.ts";
import { expandGlobSync, existsSync } from "../../deno_ral/fs.ts";
import { Command, Option } from "npm:clipanion";
import { debug, info } from "../../deno_ral/log.ts";

import { kStdOut, parseMetadataFlagValue } from "./flags.ts";

import { renderResultFinalOutput } from "./render.ts";
import { render } from "./render-shared.ts";
import { renderServices } from "./render-services.ts";
import { normalizePath } from "../../core/path.ts";
import { readYaml } from "../../core/yaml.ts";

import { RenderFlags, RenderResult } from "./types.ts";
import {
  kEmbedResources,
  kListings,
  kNumberOffset,
  kNumberSections,
  kReferenceLocation,
  kSelfContained,
  kShiftHeadingLevelBy,
  kStandalone,
  kTopLevelDivision,
} from "../../config/constants.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { PandocWrapperCommand } from "../pandoc/wrapper.ts";
import { isQuartoMetadata } from "../../config/metadata.ts";

const isValidOutput = applyCascade(
    isString(), [
      // https://github.com/quarto-dev/quarto-cli/issues/2440
      makeValidator<string>({
        test: (value, { errors, p } = {}) => {
          if (value.match(SEP_PATTERN)) {
            errors?.push(`${p ?? `.`}: option cannot specify a relative or absolute path`);
            return false
          }

          return true;
        },
      })
    ]
);

export class RenderCommand extends PandocWrapperCommand {
  static name = 'render';
  static paths = [[RenderCommand.name]];

  static usage = Command.Usage({
    description: "Render files or projects to various document types.",
    examples: [
      [
        "Render Markdown",
        [
          `$0 ${RenderCommand.name} document.qmd`,
          `$0 ${RenderCommand.name} document.qmd --to html`,
          `$0 ${RenderCommand.name} document.qmd --to pdf --toc`,
        ].join("\n")
      ],
      [
        "Render Notebook",
        [
          `$0 ${RenderCommand.name} notebook.ipynb`,
          `$0 ${RenderCommand.name} notebook.ipynb --to docx`,
          `$0 ${RenderCommand.name} notebook.ipynb --to pdf --toc`,
        ].join("\n")
      ],
      [
        "Render Project",
        [
          `$0 ${RenderCommand.name}`,
          `$0 ${RenderCommand.name} projdir`,
        ].join("\n")
      ],
      [
        "Render with Metadata",
        [
          `$0 ${RenderCommand.name} document.qmd -M echo:false`,
          `$0 ${RenderCommand.name} document.qmd -M code-fold:true`,
        ].join("\n")
      ],
      [
        "Render to Stdout",
        `$0 ${RenderCommand.name} document.qmd --output -`,
      ]
    ]
  });

  inputs = Option.Rest();

  executeCacheRefresh = Option.Boolean("--cache-refresh", { description: "Force refresh of execution cache." });
  clean = Option.Boolean("--clean", true, { description: "Clean project output-dir prior to render" });
  debug = Option.Boolean("--debug", { description: "Leave intermediate files in place after render." });
  execute_ = Option.Boolean("--execute", { description: "Execute code (--no-execute to skip execution)." });
  executeCache = Option.Boolean("--cache", { description: "Cache execution output (--no-cache to prevent cache)." });
  executeDaemon = Option.String("--execute-daemon", {
    description: "Keep Jupyter kernel alive (defaults to 300 seconds).",
    validator: isNumber(),
  });
  noExecuteDaemon = Option.Boolean("--no-execute-daemon");
  executeDaemonRestart = Option.Boolean("--execute-daemon-restart", { description: "Restart keepalive Jupyter kernel before render." });
  executeDebug = Option.Boolean("--execute-debug", { description: "Show debug output when executing computations." });
  executeDir = Option.String("--execute-dir", { description: "Working directory for code execution." });
  executeParam = Option.String("-P,--execute-param", { description: "Execution parameter (KEY:VALUE)." });
  metadata = Option.Array("-M,--metadata", { description: "Metadata value (KEY:VALUE).", validator: isArray(isString()) });
  metadataFiles = Option.Array("--metadata-files", { validator: isArray(isString()) });
  output = Option.String("-o,--output", {
    description: "Write output to FILE (use '--output -' for stdout).",
    validator: isValidOutput
  });
  outputDir = Option.String("--output-dir", { description: "Write output to DIR (path is input/project relative)" });
  paramsFile = Option.String("--execute-params", { description: "YAML file with execution parameters." });
  siteUrl = Option.String("--site-url", { description: "Override site-url for website or book output" });
  to = Option.String("-t,--to", { description: "Specify output format(s)." });
  useFreezer = Option.Boolean("--use-freezer", { description: "Force use of frozen computations for an incremental file render." });

  // TODO: should the following be documented?
  makeIndexOpts = Option.Array("--latex-makeindex-opt", { hidden: true });
  tlmgrOpts = Option.Array("--latex-tlmgr-opt", { hidden: true });

  async parseMetadata() {
    type Metadata = Record<        string,        unknown    >;
    const metadata = {} as Metadata;

    for (const file in this.metadataFiles || []) {
      if (!existsSync(file)) {
        debug(`Ignoring missing metadata file: ${file}`);
        continue;
      }

      const metadataFile = (await readYaml(file)) as Metadata;

      // TODO: merge instead of overwriting
      //   see https://github.com/quarto-dev/quarto-cli/issues/11139
      Object.assign(metadata, metadataFile);
    }

    for (const metadataValue of this.metadata || []) {
      const { name, value } = parseMetadataFlagValue(metadataValue) || {};
      if (name === undefined || value === undefined) {
        continue;
      }

      metadata[name] = value;
    }

    const quartoMetadata = {} as Metadata;
    const pandocMetadata = {} as Metadata;

    Object.entries(metadata).forEach(([key, value]) => {
      if (isQuartoMetadata(key)) {
        quartoMetadata[key] = value;
      } else {
        pandocMetadata[key] = value;
      }
    });

    return { quartoMetadata, pandocMetadata }
  }

  // TODO: this can be simplified by making the Command inherit RenderFlags and naming attributes consistently
  async parseRenderFlags() {
    const flags: RenderFlags = {};

    // converts any value to `true` but keeps `undefined`
    const isSet = (value: any): true | undefined => !(typeof value === "undefined") || value;

    const pandocWrapper = this as PandocWrapperCommand;
    flags.biblatex = pandocWrapper["biblatex"];
    flags.gladtex = pandocWrapper["gladtex"];
    flags["include-after-body"] = pandocWrapper["include-after-body"];
    flags["include-before-body"] = pandocWrapper["include-before-body"];
    flags["include-in-header"] = pandocWrapper["include-in-header"];
    flags.katex = isSet(pandocWrapper["katex"]);
    flags.mathjax = isSet(pandocWrapper["mathjax"]);
    flags.mathml = pandocWrapper["mathml"];
    flags.natbib = pandocWrapper["natbib"];
    flags.output = pandocWrapper.output;
    flags.pdfEngine = pandocWrapper["pdf-engine"];
    flags.pdfEngineOpts = pandocWrapper["pdf-engine-opt"];
    flags.to = pandocWrapper.to;
    flags.toc = pandocWrapper["toc"];
    flags.webtex = isSet(pandocWrapper["webtex"]);
    flags[kEmbedResources] = pandocWrapper["embed-resources"];
    flags[kListings] = pandocWrapper["listings"];
    flags[kNumberSections] = pandocWrapper["number-sections"] || isSet(pandocWrapper["number-offset"]);
    flags[kNumberOffset] = pandocWrapper["number-offset"];
    flags[kReferenceLocation] = pandocWrapper["reference-location"];
    flags[kSelfContained] = pandocWrapper["self-contained"];
    flags[kShiftHeadingLevelBy] = pandocWrapper["shift-heading-level-by"];
    flags[kStandalone] = pandocWrapper["standalone"];
    flags[kTopLevelDivision] = pandocWrapper["top-level-division"];

    const { quartoMetadata, pandocMetadata } = await this.parseMetadata();
    flags.metadata = quartoMetadata;
    flags.pandocMetadata = pandocMetadata;

    flags.clean = this.clean;
    flags.debug = this.debug;
    flags.execute = this.execute_;
    flags.executeCache = this.executeCacheRefresh ? "refresh" : this.executeCache;
    flags.executeDaemon = this.noExecuteDaemon ? 0 : this.executeDaemon;
    flags.executeDaemonRestart = this.executeDaemonRestart;
    flags.executeDebug = this.executeDebug;
    flags.executeDir = (!this.executeDir || isAbsolute(this.executeDir)) ? this.executeDir : normalizePath(this.executeDir);
    flags.makeIndexOpts = this.makeIndexOpts;
    flags.outputDir = this.outputDir;
    flags.paramsFile = this.paramsFile;
    flags.siteUrl = this.siteUrl;
    flags.tlmgrOpts = this.tlmgrOpts;
    flags.useFreezer = this.useFreezer;

    const param = this.executeParam && parseMetadataFlagValue(this.executeParam);
    if (param) {
      if (param.value !== undefined) {
        flags.params = flags.params || {};
        flags.params[param.name] = param.value;
      }
    }

    return flags;
  }

  async execute() {
    if (this.inputs.length === 0) {
      this.inputs = [Deno.cwd()];
      debug(`Render: Using current directory (${this.inputs[0]}) as implicit input`);
    }

    const flags = await this.parseRenderFlags();

    // run render on input files
    let renderResult: RenderResult | undefined;
    let renderResultInput: string | undefined;
    for (const input of this.inputs) {
      for (const walk of expandGlobSync(input)) {
        const services = renderServices(notebookContext());
        try {
          renderResultInput = relative(Deno.cwd(), walk.path) || ".";
          renderResult = await render(renderResultInput, {
            services,
            flags,
            pandocArgs: this.formattedPandocArgs,
            useFreezer: flags.useFreezer === true,
            setProjectDir: true,
          });

          if (renderResult.error) {
            throw renderResult.error;
          }
        } finally {
          services.cleanup();
        }
      }
    }

    if (renderResult && renderResultInput) {
      // report output created
      if (!flags.quiet && flags.output !== kStdOut) {
        const finalOutput = renderResultFinalOutput(
            renderResult,
            Deno.statSync(renderResultInput).isDirectory
                ? renderResultInput
                : dirname(renderResultInput),
        );

        if (finalOutput) {
          info("Output created: " + finalOutput + "\n");
        }
      }
    } else {
      throw new Error(`No valid input files passed to render`);
    }
  }
}
