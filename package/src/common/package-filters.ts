/*
* package-filters.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { dirname, join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "fs/mod.ts";
import { info } from "../../../src/deno_ral/log.ts";

// Creates inlined version of the filters that can be distributed with our installer
export function buildFilter(
  input: string,
  output: string,
) {
  info(`From: ${input}`);
  info(`To: ${output}`);

  const filterDir = dirname(input);
  let src = Deno.readTextFileSync(input);

  // read main filter file and extract imports
  let imports = "";
  src = src.replace(/-- \[import\][\s\S]+-- \[\/import\]/gm, (m) => {
    imports = m;
    return "";
  }).trimStart();

  const importSrcs = [];
  // append imports to src
  const importRe = /^import\("(.*)?"\)$/gm;
  let match = importRe.exec(imports);
  while (match) {
    const importFilePath = join(filterDir, match[1]);
    console.log(`Inlining ${match[1]} from ${importFilePath}`);
    let importSrc = Deno.readTextFileSync(importFilePath);
    if (!importSrc.endsWith("\n")) {
      importSrc += "\n";
    }
    importSrcs.push(importSrc);
    match = importRe.exec(imports);
  }
  importSrcs.push(src);
  src = importSrcs.join("");

  // write src to dist
  info(`Writing inlined file ${output}`);

  const dir = dirname(output);
  info(`Ensure directory ${dir} exists`);
  ensureDirSync(dir);

  info(`Writing inlined ${output}`);
  Deno.writeTextFileSync(output, src);
}
