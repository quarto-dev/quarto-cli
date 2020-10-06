import { parse } from "encoding/yaml.ts";

import type { QuartoConfig } from "./config.ts";
import { execProcess, ProcessResult } from "./process.ts";
import { resourcePath } from "./resources.ts";

export type Metadata = {
  quarto?: QuartoConfig;
  [key: string]: unknown;
};

// this command line:
// pandoc test.Rmd  --from markdown  -t markdown --template=metadata.template
// along w/ this template:
/*
$if(titleblock)$
$titleblock$
$endif$
*/
// would get us the title block but only the title block. may need to actually
// process the file line by line to get raw yaml (as $meta-json$ interpets
// true as "true", etc.)

export async function metadataFromMarkdown(
  markdown: string,
): Promise<Metadata> {
  if (markdown) {
    const result = await execProcess(pandocMetadataRunOptions([]), markdown);
    return handleMetadataResult(result);
  } else {
    return {};
  }
}

export async function metadataFromFile(file: string): Promise<Metadata> {
  // TODO: we need to read the file line by line or with regexes
  // so that pandoc doesn't sort our output format keys
  const result = await execProcess(pandocMetadataRunOptions([file]));
  return handleMetadataResult(result);
}

function pandocMetadataRunOptions(args: string[]): Deno.RunOptions {
  return {
    cmd: [
      "pandoc",
      "--template=" + resourcePath("metadata.template"),
      "--from",
      "markdown",
      "--to",
      "markdown",
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
  };
}

function handleMetadataResult(result: ProcessResult): Promise<Metadata> {
  if (result.success) {
    const yaml = (result.stdout || "{}")
      .replace(/^---/, "")
      .replace(/---\s*$/, "");
    const metadata = parse(yaml);
    return Promise.resolve((metadata || {}) as Metadata);
  } else {
    return Promise.reject(new Error(result.stderr));
  }
}
