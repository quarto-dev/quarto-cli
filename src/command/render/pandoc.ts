import { basename, dirname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import type { FormatPandocOptions } from "../../api/format.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";
import { writeLine } from "../../core/console.ts";

export interface PandocOptions {
  input: string;
  output?: string;
  format: FormatPandocOptions;
  args: string[];
  quiet?: boolean;
}

export async function runPandoc(
  options: PandocOptions,
): Promise<ProcessResult> {
  // build the pandoc command
  const cmd = ["pandoc", basename(options.input)];

  // TODO: --output - gets eaten by cliffy, may need to re-inject it

  // provide output argument if not specified by the user
  if (!options.output && options.output !== "-") {
    options.output = basename(options.input, ".md") + "." +
      (options.format["output-ext"] as string);
    cmd.push("--output", options.output);
  }

  // remove output-ext (as it's just for us not pandoc)
  delete options.format["output-ext"];

  // write a temporary default file from the options
  const yaml = "---\n" + stringify(options.format);
  const yamlFile = await Deno.makeTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(yamlFile, yaml);
  cmd.push("--defaults", yamlFile);

  // add user command line args
  cmd.push(...options.args);

  // print command and defaults file
  if (!options.quiet) {
    writeLine("quarto render " + options.input + " " + options.args.join(" "));
    writeLine(yaml + "---\n");
  }

  // run pandoc
  const result = await execProcess({
    cmd,
    cwd: dirname(options.input),
  });

  // TODO: delete the pandocInput or not based on keep_md

  // write outpput created (read by rstudio for preview) unless output went to stdout
  if (!options.quiet && options.output !== "-") {
    // TODO: correct relative path so the IDE will always be able to preview it
    writeLine("Output created: " + options.output + "\n");
  }

  return result;
}
