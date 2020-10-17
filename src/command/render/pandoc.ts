import { basename, dirname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import type { FormatPandoc } from "../../api/format.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";
import { consoleWriteLine } from "../../core/console.ts";
import { Metadata, metadataFromFile } from "../../config/metadata.ts";
import { mergeConfigs } from "../../config/config.ts";
import { isPdfOutput } from "./output.ts";

export interface PandocOptions {
  input: string;
  format: FormatPandoc;
  args: string[];
  quiet?: boolean;
}

export async function runPandoc(
  options: PandocOptions,
): Promise<ProcessResult> {
  // build the pandoc command
  const cmd = ["pandoc", basename(options.input)];

  // write a temporary default file from the options
  const yaml = "---\n" + stringify(options.format);
  const yamlFile = await Deno.makeTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(yamlFile, yaml);
  cmd.push("--defaults", yamlFile);

  // add citeproc if necessary
  const citeproc = await citeprocRequired(options);
  if (citeproc) {
    cmd.push("--citeproc");
  }

  // add user command line args
  cmd.push(...options.args);

  // print defaults file and command line args
  if (!options.quiet) {
    if (options.args.length > 0) {
      consoleWriteLine(yaml + "args: " + options.args.join(" "));
    } else {
      consoleWriteLine(yaml);
    }
    consoleWriteLine("---\n");
  }

  // run pandoc
  return await execProcess({
    cmd,
    cwd: dirname(options.input),
  });
}

export async function citeprocRequired(
  options: PandocOptions,
): Promise<boolean> {
  // get all metadata from the input file
  const inputMetadata = await metadataFromFile(options.input);

  // derive 'final' metadata by merging the format definition
  const metadata = mergeConfigs(options.format, inputMetadata);

  return citeMethod(
    metadata,
    options.args,
    isPdfOutput(options.format.writer),
  ) === CiteMethod.Citeproc;
}

export enum CiteMethod {
  Citeproc = "citeproc",
  Natbib = "natbib",
  Biblatex = "biblatex",
}

export function citeMethod(
  metadata: Metadata,
  args: string[],
  isPdf: boolean,
): CiteMethod | null {
  // check for explicit disable
  if (metadata.citeproc === false) {
    return null;
  }

  // no handler if no references
  if (!metadata.bibliography && !metadata.references) {
    return null;
  }

  // if there is an explicit cite-method then use it
  if (metadata["cite-method"]) {
    return metadata["cite-method"] as CiteMethod;
  }

  // if it's pdf-based output check for natbib or biblatex on the command line
  if (isPdf) {
    if (args.includes("--natbib")) {
      return CiteMethod.Natbib;
    } else if (args.includes("--biblatex")) {
      return CiteMethod.Biblatex;
    }
  }

  // otherwise it's citeproc
  return CiteMethod.Citeproc;
}
