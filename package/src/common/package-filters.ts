import { dirname, join } from "https://deno.land/std/path/mod.ts";
import { Logger } from "./logger.ts";
import { ensureDirExists } from "./utils.ts";

export function buildFilter(
  input: string,
  output: string,
  log: Logger,
) {
  log.info(`From: ${input}`);
  log.info(`To: ${output}`);

  const filterDir = dirname(input);
  let src = Deno.readTextFileSync(input);

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
  log.info(`Writing inlined file ${output}`);

  const dir = dirname(output);
  log.info(`Ensure directory ${dir} exists`);
  if (ensureDirExists(dir)) {
    log.info(`Created directory ${dir}`);
  }

  log.info(`Writing inlined ${output}`);
  Deno.writeTextFileSync(output, src);
}
