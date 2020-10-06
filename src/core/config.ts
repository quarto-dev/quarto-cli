import { dirname, join } from "path/mod.ts";
import { exists } from "fs/exists.ts";
import { parse } from "encoding/yaml.ts";

import { ld } from "lodash/mod.ts";

import { metadataFromFile, metadataFromMarkdown } from "./metadata.ts";
import type { FormatPandocOptions } from "../api/format.ts";

export interface QuartoConfig {
  pandoc?: { [key: string]: unknown };
  figure?: FormatPandocOptions;
  [key: string]: unknown;
}

export async function configFromMarkdown(
  markdown: string,
): Promise<QuartoConfig> {
  return (await metadataFromMarkdown(markdown)).quarto || {};
}

export async function configFromMarkdownFile(
  file: string,
): Promise<QuartoConfig> {
  return (await metadataFromFile(file)).quarto || {};
}

export async function projectConfig(file: string): Promise<QuartoConfig> {
  file = await Deno.realPath(file);
  let dir: string | undefined;
  while (true) {
    // determine next directory to inspect (terminate if we can't go any higher)
    if (!dir) {
      dir = dirname(file);
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        return {};
      } else {
        dir = nextDir;
      }
    }

    // see if there is a quarto yml file there
    const quartoYml = join(dir, "_quarto.yml");
    if (await exists(quartoYml)) {
      const decoder = new TextDecoder("utf-8");
      const yml = await Deno.readFile(quartoYml);
      return parse(decoder.decode(yml)) as QuartoConfig;
    }
  }
}

export function mergeConfigs(...configs: QuartoConfig[]): QuartoConfig {
  return ld.merge(configs[0], ...configs.slice(1));
}
