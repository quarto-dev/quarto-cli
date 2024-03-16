/*
 * engine-shared.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { dirname, isAbsolute, join } from "../deno_ral/path.ts";

import { restorePreservedHtml } from "../core/jupyter/preserve.ts";
import { PostProcessOptions } from "./types.ts";

export function postProcessRestorePreservedHtml(options: PostProcessOptions) {
  // read the output file

  const outputPath = isAbsolute(options.output)
    ? options.output
    : join(dirname(options.target.input), options.output);
  let output = Deno.readTextFileSync(outputPath);

  // substitute
  output = restorePreservedHtml(
    output,
    options.preserve,
  );

  // re-write the output
  Deno.writeTextFileSync(outputPath, output);
}

export function languagesInMarkdownFile(file: string) {
  return languagesInMarkdown(Deno.readTextFileSync(file));
}

export function languagesInMarkdown(markdown: string) {
  // see if there are any code chunks in the file
  const languages = new Set<string>();
  const kChunkRegex = /^[\t >]*```+\s*\{([a-zA-Z0-9_]+)( *[ ,].*)?\}\s*$/gm;
  kChunkRegex.lastIndex = 0;
  let match = kChunkRegex.exec(markdown);
  while (match) {
    const language = match[1].toLowerCase();
    if (!languages.has(language)) {
      languages.add(language);
    }
    match = kChunkRegex.exec(markdown);
  }
  kChunkRegex.lastIndex = 0;
  return languages;
}
