/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { join } from "path/mod.ts";
import { copy } from "fs/copy.ts";

import { lines } from "../../core/text.ts";
import { execProcess } from "../../core/process.ts";
import { esbuildCompile } from "../../core/esbuild.ts";
import { buildSchemaFile } from "../../core/schema/build-schema-file.ts";

async function buildQuartoOJS(resourceDir: string) {
  const src = await esbuildCompile(
    "",
    join(resourceDir, "formats/html/ojs"),
    ["quarto-ojs.js"],
    "esm",
  );
  await Deno.writeTextFile(join(resourceDir, "build/quarto-ojs.js"), src!);

  // FIXME ideally we'd use the one directly in build, but right now
  // we depend on the file being in a particular place (and with an
  // especially bad name).  We copy for now.
  return copy(
    join(resourceDir, "build/quarto-ojs.js"),
    join(resourceDir, "formats/html/ojs/esbuild-bundle.js"),
    { overwrite: true },
  );
}

async function buildYAMLJS(resourceDir: string) {
  const intelligenceSrc = await esbuildCompile(
    "",
    join(resourceDir, "../core/lib/yaml-intelligence"),
    ["yaml-intelligence.ts"],
    "esm",
  );
  Deno.writeTextFileSync(join(resourceDir, "editor/tools/yaml/yaml-intelligence.js"), intelligenceSrc!);

  const finalBuild = await esbuildCompile(
    "",
    join(resourceDir, "editor/tools/yaml"),
    ["automation.js"],
    "iife",
  );

  const treeSitter = Deno.readTextFileSync(join(resourceDir, "editor/tools/yaml/tree-sitter.js"));

  Deno.writeTextFileSync(join(resourceDir, "editor/tools/yaml/yaml.js"), [treeSitter,finalBuild!].join(""));
}

export async function buildAssets() {
  const result = await execProcess({
    cmd: ["quarto", "--paths"],
    stdout: "piped",
  });

  const [_binPath, resourceDir] = lines(result.stdout!);

  // these go first because they create files that will be consumed by YAMLJS
  await buildSchemaFile(resourceDir);

  return Promise.all([
    buildSchemaFile(resourceDir),
    buildQuartoOJS(resourceDir),
    buildYAMLJS(resourceDir),
  ]);
}

export const buildJsCommand = new Command()
  .name("build-js")
  .hidden()
  .description(
    "Builds all the javascript assets necessary for IDE support.\n\n",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, _path: string) => {
    await buildAssets();
  });
