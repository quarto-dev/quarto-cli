import { existsSync } from "fs/exists.ts";

import { parse } from "encoding/yaml.ts";

export function readYAML(file: string) {
  if (existsSync(file)) {
    const decoder = new TextDecoder("utf-8");
    const yml = Deno.readFileSync(file);
    return parse(decoder.decode(yml));
  } else {
    throw new Error(`YAML file ${file} not found.`);
  }
}
