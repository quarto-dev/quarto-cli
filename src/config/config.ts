/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { dirname, join } from "path/mod.ts";
import { exists } from "fs/exists.ts";
import { ld } from "lodash/mod.ts";

import type { Format } from "../api/format.ts";

import { metadataFromFile, metadataFromMarkdown } from "./metadata.ts";
import { readYAML } from "../core/yaml.ts";

export interface Config {
  [key: string]: Format;
}

export function configFromMarkdown(
  markdown: string,
): Config {
  return (metadataFromMarkdown(markdown)).quarto || {};
}

export function configFromMarkdownFile(
  file: string,
): Config {
  return (metadataFromFile(file)).quarto || {};
}

export async function projectConfig(file: string): Promise<Config> {
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
      const config = readYAML(quartoYml) as Config;
      return resolveConfig(config);
    }
  }
}

// resolve 'default' configs and merge common options
export function resolveConfig(config: Config) {
  // config to return
  const newConfig = { ...config };

  // resolve 'default'
  Object.keys(newConfig).forEach((key) => {
    if (typeof newConfig[key] === "string") {
      newConfig[key] = {};
    }
  });

  if (newConfig.common) {
    // pull out common
    const common = newConfig.common;
    delete newConfig.common;

    // merge with each format
    Object.keys(newConfig).forEach((key) => {
      newConfig[key] = mergeConfigs(common, newConfig[key]);
    });
  }

  return newConfig;
}

export function mergeConfigs<T>(...configs: T[]): T {
  // copy all configs so we don't mutate them
  configs = ld.cloneDeep(configs);

  return ld.mergeWith(
    configs[0],
    ...configs.slice(1),
    (objValue: unknown, srcValue: unknown) => {
      if (ld.isArray(objValue) && ld.isArray(srcValue)) {
        const combined = (objValue as Array<unknown>).concat(
          srcValue as Array<unknown>,
        );
        return ld.uniqBy(combined, ld.toString);
      }
    },
  );
}
