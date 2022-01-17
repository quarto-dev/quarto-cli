/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { join } from "path/mod.ts";
import { copy } from "fs/copy.ts";
import { createTempContext } from "../../core/temp.ts";

import { lines } from "../../core/text.ts";
import { esbuildCompile } from "../../core/esbuild.ts";
import { buildSchemaFile } from "../../core/schema/build-schema-file.ts";
import { resourcePath } from "../../core/resources.ts";

async function buildQuartoOJS() {
  const src = await esbuildCompile(
    "",
    resourcePath("formats/html/ojs"),
    ["quarto-ojs.js"],
    "esm",
  );
  await Deno.writeTextFile(resourcePath("build/quarto-ojs.js"), src!);

  // FIXME ideally we'd use the one directly in build, but right now
  // we depend on the file being in a particular place (and with an
  // especially bad name).  We copy for now.
  return copy(
    resourcePath("build/quarto-ojs.js"),
    resourcePath("formats/html/ojs/esbuild-bundle.js"),
    { overwrite: true },
  );
}

async function buildYAMLJS() {
  const intelligenceSrc = await esbuildCompile(
    "",
    resourcePath("../core/lib/yaml-intelligence"),
    ["yaml-intelligence.ts"],
    "esm",
  );
  Deno.writeTextFileSync(resourcePath("editor/tools/yaml/yaml-intelligence.js"), intelligenceSrc!);

  const finalBuild = await esbuildCompile(
    "",
    resourcePath("editor/tools/yaml"),
    ["automation.js"],
    "iife",
  );

  const treeSitter = Deno.readTextFileSync(resourcePath("editor/tools/yaml/tree-sitter.js"));

  Deno.writeTextFileSync(resourcePath("editor/tools/yaml/yaml.js"), [treeSitter,finalBuild!].join(""));
}

export async function buildAssets() {
  const temp = createTempContext();
  try {
    // this has to come first because buildYAMLJS depends on it.
    await Promise.all([
      buildSchemaFile(temp),
      buildQuartoOJS(),
      buildYAMLJS(),
    ]);
  } finally {
    temp.cleanup();
  }
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
