import { basename, dirname, join } from "https://deno.land/std/path/mod.ts";

buildFilter("crossref");

function buildFilter(filter: string) {
  // read main filter file
  const filterPath = join(`${filter}.lua`);
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
    let importSrc = Deno.readTextFileSync(join(filterDir, match[1]));
    if (!importSrc.endsWith("\n")) {
      importSrc += "\n";
    }
    src = `${importSrc}\n` + src;
    match = importRe.exec(imports);
  }

  // write src to dist
  Deno.writeTextFileSync(basename(filterPath), src);
}
