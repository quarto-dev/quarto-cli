/*
 * self-contained.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { basename, dirname } from "path/mod.ts";
import { formatResourcePath, pandocBinaryPath } from "../../core/resources.ts";
import { execProcess } from "../../core/process.ts";

export const pandocIngestSelfContainedContent = async (
  file: string,
  resourcePath?: string[],
) => {
  const filename = basename(file);
  const workingDir = dirname(file);

  // The template
  const template = formatResourcePath(
    "html",
    "pandoc-selfcontained/selfcontained.html",
  );

  // The raw html contents
  const contents = Deno.readTextFileSync(file);
  const input: string[] = [];
  input.push("````````{=html}");
  input.push(contents);
  input.push("````````");

  // Run pandoc to suck in dependencies
  const cmd = [pandocBinaryPath()];
  cmd.push("--to", "html");
  cmd.push("--from", "markdown");
  cmd.push("--template", template);
  cmd.push("--output", filename);
  cmd.push("--metadata", "title=placeholder");
  cmd.push("--embed-resources");
  if (resourcePath && resourcePath.length) {
    cmd.push("--resource-path", resourcePath.join(":"));
  }
  const result = await execProcess({
    cmd,
    stdout: "piped",
    cwd: workingDir,
  }, input.join("\n"));

  if (result.success) {
    return result.stdout;
  } else {
    throw new Error();
  }
};
