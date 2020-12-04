import { basename, dirname, join } from "https://deno.land/std/path/mod.ts";

buildFilter("crossref");
buildFilter("figures");

function buildFilter(filter: string) {
  // read main filter file
  const filterPath = join(
    "..",
    "..",
    "src",
    "resources",
    "filters",
    filter,
    `${filter}.lua`,
  );
  const outFilterPath = join(
    "filters",
    filter,
    `${filter}.lua`,
  );

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
  }

  // write src to dist
  Deno.writeTextFileSync(outFilterPath, src);
}
