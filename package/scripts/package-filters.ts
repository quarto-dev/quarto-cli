import { basename, dirname, join } from "https://deno.land/std/path/mod.ts";
import { walk } from "https://deno.land/std@0.76.0/fs/walk.ts";

buildFilter("crossref");

function buildFilter(filter: string) {
  // read main filter file
  const filterPath = join(filter, `${filter}.lua`);
  const filterDir = dirname(filterPath);
  let src = Deno.readTextFileSync(filterPath);

  // read main filter file and extract imports
  let imports = "";
  src = src.replace(/-- \[import\][\s\S]+-- \[\/import\]/gm, (m) => {
    imports = m;
    return "";
  }).trimStart();

  // append imports to src
  const importRe = /^import\("(.*)?"\)$/gm;
  let match = importRe.exec(imports);
  while (match) {
    const importFilePath = join(filterDir, match[1]);
    let importSrc = Deno.readTextFileSync(importFilePath);
    if (!importSrc.endsWith("\n")) {
      importSrc += "\n";
    }
    src = `${importSrc}\n` + src;
    match = importRe.exec(imports);
    Deno.removeSync(importFilePath);

    // If this is the last source file in a directory, clean the directory
    const directory = dirname(importFilePath);
    if (isEmpty(directory)) {
      Deno.removeSync(directory);
    }
  }

  // write src to dist
  Deno.writeTextFileSync(filterPath, src);
}

function isEmpty(path: string): boolean {
  const realDir = Deno.realPathSync(path);
  const directoryContents = Deno.readDirSync(path);
  for (const foo of directoryContents) {
    return false;
  }
  return true;
}
