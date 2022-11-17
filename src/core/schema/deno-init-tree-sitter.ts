/*
* deno-init-tree-sitter.ts
*
* code to initialize tree sitter on deno.
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { resourcePath } from "../resources.ts";

//@ts-ignore: importing from .js makes type-script unhappy
import {
  setWasmBinaryFile,
  TreeSitter,
} from "../lib/external/tree-sitter-deno.js";
import { setMainPath } from "../lib/yaml-intelligence/paths.ts";
import { setTreeSitter } from "../lib/yaml-intelligence/parsing.ts";

export async function initTreeSitter() {
  // run standard initialization...

  // ... and then the tree-sitter specific bits;
  setWasmBinaryFile(
    Deno.readFileSync(resourcePath("editor/tools/yaml/tree-sitter.wasm")),
  );

  //@ts-ignore: importing from .js makes type-script unhappy
  //deno-lint-ignore no-explicit-any
  const treeSitter: any = TreeSitter;
  await treeSitter.init();

  const parser = new treeSitter();
  const language = await treeSitter.Language.load(
    resourcePath("editor/tools/yaml/tree-sitter-yaml.wasm"),
  );
  parser.setLanguage(language);

  setMainPath("https://example.com");

  setTreeSitter(parser);
}
