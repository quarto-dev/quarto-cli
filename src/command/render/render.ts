import { stringify } from "encoding/yaml.ts";

import { Command } from "cliffy/command/mod.ts";
import { parseFlags } from "cliffy/flags/mod.ts";

import { basename, dirname, extname, join } from "path/mod.ts";
import type { FormatOptions } from "../../api/format.ts";
import { computationEngineForFile } from "../../computation/engine.ts";
import {
  mergeConfigs,
  projectConfig,
  QuartoConfig,
  resolveConfig,
} from "../../core/config.ts";
import { writeLine } from "../../core/console.ts";

import { execProcess, ProcessResult } from "../../core/process.ts";

import { optionsFromConfig } from "./options.ts";

// TODO: correct handling of --output command line

// TODO: cleanup all the todos in render and the rmd engine

// TODO: generally, error handling for malformed input (e.g. yaml)

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("<input:string> [...pandoc-args:string]")
  .description(
    "Render a file using the supplied target format and pandoc command line arguments.",
  )
  .example(
    "Render R Markdown",
    "quarto render notebook.Rmd\n" +
      "quarto render notebook.Rmd --to html\n" +
      "quarto render notebook.Rmd --to pdf --toc",
  )
  .example(
    "Render Jupyter Notebook",
    "quarto render notebook.ipynb\n" +
      "quarto render notebook.ipynb --to docx\n" +
      "quarto render notebook.ipynb --to docx --highlight-style=espresso\n",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string, pandocArgs: string[]) => {
    try {
      const flags = parseFlags(pandocArgs);
      const to = flags.flags.t || flags.flags.to;
      const result = await render({ input, to, pandocArgs });
      if (!result.success) {
        // error diagnostics already written to stderr
        Deno.exit(result.code);
      }
    } catch (error) {
      if (error) {
        writeLine(Deno.stderr, error.toString());
      }
      Deno.exit(1);
    }
  });

export interface RenderArgs {
  input: string;
  to?: string;
  pandocArgs: string[];
}

export async function render(renderArgs: RenderArgs): Promise<ProcessResult> {
  // look for a 'project' _quarto.yml
  const projConfig: QuartoConfig = await projectConfig(renderArgs.input);

  // determine path to mdInput file and preprocessor
  let preprocessorOutput: string;

  // execute computational preprocessor (if any)
  const ext = extname(renderArgs.input);

  // TODO: still need to read the YAML out of plain markdown

  let options: FormatOptions | undefined;

  const engine = computationEngineForFile(ext);
  if (engine) {
    // extract metadata
    const fileMetadata = await engine.metadata(renderArgs.input);

    // get the file config
    const fileConfig = resolveConfig(fileMetadata.quarto || {});

    // determine which writer to use
    let writer = renderArgs.to;
    if (!writer) {
      writer = "html";
      const formats = Object.keys(fileConfig).concat(
        Object.keys(projectConfig),
      );
      if (formats.length > 0) {
        writer = formats[0];
      }
    }

    // derive quarto config from merge of project config into file config
    const config = mergeConfigs(projConfig, fileConfig);

    // get the format
    options = optionsFromConfig(writer, config);

    // override the writer based on computed (incorporates command line)

    // TODO: make sure we don't overrwite existing .md
    // TODO: may want to ensure foo.quarto-rmd.md, foo.quarto-ipynb.md, etc.

    const inputDir = dirname(renderArgs.input);
    const inputBase = basename(renderArgs.input, ext);
    preprocessorOutput = join(inputDir, inputBase + ".md");
    const result = await engine.process(
      renderArgs.input,
      options,
      preprocessorOutput,
    );

    // TODO: clean intermediates referenced in result
  } else {
    preprocessorOutput = renderArgs.input;
  }

  // build the pandoc command
  const cmd = ["pandoc", basename(preprocessorOutput)];

  // default output file
  // TODO: handle stdout and propagating user-specified output file
  // to RStudio @ the botoom
  let output = basename(renderArgs.input, ext) + "." +
    (options!.pandoc!["output-ext"]!);
  cmd.push("--output", output);

  // remove output-ext (as it's just for us not pandoc)
  const pandoc = options!.pandoc!;
  delete pandoc["output-ext"];

  // write a temporary default file from the options
  const yaml = "---\n" + stringify(pandoc);

  const yamlFile = await Deno.makeTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(yamlFile, yaml);
  cmd.push("--defaults", yamlFile);

  // add user command line args
  cmd.push(...renderArgs.pandocArgs);

  writeLine(
    Deno.stderr,
    "quarto render " + renderArgs.input + " " + renderArgs.pandocArgs.join(" "),
  );
  writeLine(
    Deno.stderr,
    yaml + "---",
  );
  writeLine(Deno.stderr, "");

  // run pandoc
  const result = await execProcess({
    cmd,
    cwd: dirname(preprocessorOutput),
  });

  // TODO: delete the preprocessorOutput or not based on keep_md

  // TODO: correct relative path so the IDE will always be able to preview it

  const flags = parseFlags(renderArgs.pandocArgs);
  const stdout = flags.flags.o === true || flags.flags.output === true;
  if (!stdout) {
    writeLine(Deno.stderr, "Output created: " + output + "\n");
  }

  return result;
}
