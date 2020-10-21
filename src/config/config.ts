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

import { readYaml, readYamlFromMarkdownFile } from "../core/yaml.ts";

import {
  kFigDpi,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepMd,
  kKeepTex,
  kKeepYaml,
  kMdExtensions,
  kOutputExt,
  kPandocDefaults,
  kPandocMetadata,
  kShowCode,
  kShowError,
  kShowWarning,
} from "./constants.ts";
import { computationEngineForFile } from "../computation/engine.ts";
import { defaultWriterFormat } from "./formats.ts";
import { mergeConfigs } from "../core/config.ts";

export type Config = {
  format?: { [key: string]: Format };
  [key: string]: unknown;
};

// pandoc output format
export interface Format {
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "png" | "pdf";
  [kFigDpi]?: number;
  [kShowCode]?: boolean;
  [kShowWarning]?: boolean;
  [kShowError]?: boolean;
  [kKeepMd]?: boolean;
  [kKeepYaml]?: boolean;
  [kKeepTex]?: boolean;
  [kOutputExt]?: string;
  defaults?: PandocDefaults;
  metadata?: { [key: string]: unknown };
}

export interface PandocDefaults {
  from?: string;
  to?: string;
  [kMdExtensions]?: string;
  [key: string]: unknown;
}

export interface InputFileConfig {
  config: Config;
  defaultWriter: string;
}

export async function inputFileConfig(
  input: string,
  configOverrides?: string,
  to?: string,
): Promise<InputFileConfig> {
  // look for a 'project' _quarto.yml
  const projConfig: Config = await projectConfig(input);

  // get metadata from computational preprocessor (or from the raw .md)
  const engine = computationEngineForFile(input);
  let inputConfig = engine
    ? await engine.metadata(input)
    : readYamlFromMarkdownFile(input);

  // merge in any options provided via file
  if (configOverrides) {
    const overrides = readYaml(configOverrides) as Config;
    inputConfig = mergeConfigs(inputConfig, overrides);
  }

  // determine which writer to use
  let defaultWriter = to;
  if (!defaultWriter) {
    defaultWriter = "html";
    const formats = Object.keys(inputConfig).concat(
      Object.keys(projectConfig),
    );
    if (formats.length > 0) {
      defaultWriter = formats[0];
    }
  }

  // derive quarto config from merge of project config into file config
  const config = mergeConfigs(projConfig, inputConfig);

  return {
    config,
    defaultWriter,
  };
}

export function resolveFormatFromConfig(
  to: string,
  config: Config,
  debug?: boolean,
) {
  // get the format
  const format = formatFromConfig(to, config);

  // force keep_md and keep_tex if we are in debug mode
  if (debug) {
    format[kKeepMd] = true;
    format[kKeepTex] = true;
  }

  return format;
}

function formatFromConfig(
  to: string,
  config: Config,
): Format {
  // get default options for this writer
  let format = defaultWriterFormat(to);

  // see if there is config for this writer
  if (config.format?.[to] instanceof Object) {
    format = mergeConfigs(format, config.format?.[to]);
  }

  // move top-level keys to the appropriate subkey

  Object.keys(format).forEach((key) => {
    if (
      ![
        kFigWidth,
        kFigHeight,
        kFigFormat,
        kFigDpi,
        kShowCode,
        kShowWarning,
        kShowError,
        kKeepMd,
        kKeepYaml,
        kKeepTex,
        kOutputExt,
        kPandocDefaults,
        kPandocMetadata,
      ].includes(
        key,
      )
    ) {
      format.defaults = format.defaults || {};
      // deno-lint-ignore no-explicit-any
      format.defaults[key] = (format as any)[key];
      // deno-lint-ignore no-explicit-any
      delete (format as any)[key];
    }
  });

  return format;
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
      return readYaml(quartoYml) as Config;
    }
  }
}
