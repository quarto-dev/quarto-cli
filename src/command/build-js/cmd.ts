/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { join, relative } from "path/mod.ts";
import { copy } from "fs/copy.ts";

import { lines } from "../../core/text.ts";
import { execProcess } from "../../core/process.ts";
import { esbuild, esbuildCompile } from "../../core/esbuild.ts";
import { buildSchemaFile } from "../../core/schema/build-schema-file.ts";
import { quartoConfig } from "../../core/quarto.ts";

async function buildCoreLib(resourceDir: string) {
  const src = await esbuildCompile(
    "",
    join(resourceDir, "../core/lib"),
    ["index.ts"],
    "esm",
  );
  await Deno.writeTextFileSync(join(resourceDir, "build/core-lib.js"), src!);
}

async function buildQuartoOJS(resourceDir: string) {
  const relativeRes = (path: string) =>
    relative(Deno.cwd(), join(resourceDir, path));

  await esbuild({
    entryPoints: [relativeRes("formats/html/ojs/quarto-ojs.js")],
    outfile: relativeRes("build/quarto-ojs.js"),
  });

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
  const path = join(resourceDir, "editor/tools/yaml");
  const automationSrc = await esbuildCompile(
    "",
    path,
    ["automation.js"],
    "iife",
  );

  const files = [
    "tree-sitter.js",
    "external/ajv7.bundle.js",
    "ajv-stub.js",
  ].map((filename) => Deno.readTextFileSync(join(path, filename)));
  files.push(automationSrc!);
  return Deno.writeTextFile(join(path, "yaml.js"), files.join(""));
}

export async function buildAssets() {
  // Set environment variable so that the deno esbuild library finds
  // the esbuild binary and doesn't install it somewhere else.

  // FIXME will this work on windows?
  // then again, will anyone build assets on windows?
  Deno.env.set("ESBUILD_BINARY_PATH", join(quartoConfig.binPath(), "esbuild"));

  const result = await execProcess({
    cmd: ["quarto", "--paths"],
    stdout: "piped",
  });

  const [_binPath, resourceDir] = lines(result.stdout!);

  // this has to come first because buildYAMLJS depends on it.
  await buildCoreLib(resourceDir);

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
