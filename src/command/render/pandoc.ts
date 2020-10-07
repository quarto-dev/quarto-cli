import { basename, dirname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { parseFlags } from "cliffy/flags/mod.ts";

import type { FormatPandocOptions } from "../../api/format.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";
import { writeLine } from "../../core/console.ts";

export async function runPandoc(
  input: string,
  options: FormatPandocOptions,
  args: string[],
): Promise<ProcessResult> {
  // build the pandoc command
  const cmd = ["pandoc", basename(input)];

  // default output file
  // TODO: handle stdout and propagating user-specified output file
  // to RStudio @ the botoom

  let output = basename(input, ".md") + "." + (options["output-ext"] as string);
  cmd.push("--output", output);

  // remove output-ext (as it's just for us not pandoc)
  delete options["output-ext"];

  // write a temporary default file from the options
  const yaml = "---\n" + stringify(options);

  const yamlFile = await Deno.makeTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(yamlFile, yaml);
  cmd.push("--defaults", yamlFile);

  // add user command line args
  cmd.push(...args);

  writeLine("quarto render " + input + " " + args.join(" "));
  writeLine(yaml + "---\n");

  // run pandoc
  const result = await execProcess({
    cmd,
    cwd: dirname(input),
  });

  // TODO: delete the pandocInput or not based on keep_md

  // TODO: correct relative path so the IDE will always be able to preview it

  const flags = parseFlags(args);
  const stdout = flags.flags.o === true || flags.flags.output === true;
  if (!stdout) {
    writeLine("Output created: " + output + "\n");
  }

  return result;
}
