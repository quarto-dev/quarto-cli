/*
 * self-contained.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { basename, dirname, join } from "../../deno_ral/path.ts";
import { formatResourcePath, pandocBinaryPath } from "../../core/resources.ts";
import { execProcess } from "../../core/process.ts";
import { parseHtml } from "../deno-dom.ts";
import { Element, HTMLDocument } from "deno_dom/deno-dom-wasm-noinit.ts";
import { esbuildCompile } from "../esbuild.ts";
import { asDataUrl } from "../data-url.ts";

const bundleModules = async (dom: HTMLDocument, workingDir: string) => {
  const modules = dom.querySelectorAll("script[type='module']");
  for (const module of modules) {
    const src = (module as Element).getAttribute("src");
    if (src) {
      const srcName = join(workingDir, src);
      const srcDir = dirname(srcName);
      const jsSource = await esbuildCompile(
        Deno.readTextFileSync(srcName),
        srcDir,
        [],
        "esm",
      );
      (module as Element).setAttribute(
        "src",
        asDataUrl(jsSource!, "application/javascript"),
      );
    }
  }
};

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
  const doctypeMatch = contents.match(/^<!DOCTYPE.*?>/);
  const dom = await parseHtml(contents);
  await bundleModules(dom, workingDir);

  const input: string[] = [];
  input.push("````````{=html}");
  if (doctypeMatch) {
    input.push(doctypeMatch[0]);
  }
  input.push(dom.documentElement!.outerHTML);
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
    cmd: cmd[0],
    args: cmd.slice(1),
    stdout: "piped",
    cwd: workingDir,
  }, input.join("\n"));

  if (result.success) {
    return result.stdout;
  } else {
    throw new Error();
  }
};
