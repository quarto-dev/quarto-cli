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
  kComputeDefaults,
  kComputeDefaultsKeys,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepMd,
  kKeepTex,
  kKeepYaml,
  kMdExtensions,
  kOutputExt,
  kPandocDefaults,
  kPandocDefaultsKeys,
  kPandocMetadata,
  kRenderDefaults,
  kRenderDefaultsKeys,
  kShowCode,
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
  render?: FormatRender;
  compute?: FormatCompute;
  pandoc?: FormatPandoc;
  metadata?: FormatMetadata;
}

export interface FormatRender {
  [kKeepMd]?: boolean;
  [kKeepYaml]?: boolean;
  [kKeepTex]?: boolean;
}

export interface FormatCompute {
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "png" | "pdf";
  [kShowCode]?: boolean;
  [kShowWarning]?: boolean;
}

export interface FormatPandoc {
  from?: string;
  to?: string;
  [kMdExtensions]?: string;
  [kOutputExt]?: string;
  [key: string]: unknown;
}

export interface FormatMetadata {
  [key: string]: unknown;
}

export interface InputFileConfig {
  config: Config;
  defaultWriter: string;
}

export async function inputFileConfig(
  input: string,
  overridesFile?: string,
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
  if (overridesFile) {
    const overrides = readYaml(overridesFile) as Config;
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

export function formatFromConfig(
  to: string,
  config: Config,
  debug?: boolean,
): Format {
  // user format options (allow any b/c this is just untyped yaml)
  // deno-lint-ignore no-explicit-any
  let format: any = {};

  // see if there is user config for this writer that we need to merge in
  if (config.format?.[to] instanceof Object) {
    format = config.format?.[to];
    Object.keys(format).forEach((key) => {
      // allow stuff already sorted into a top level key through unmodified
      if (
        ![kRenderDefaults, kComputeDefaults, kPandocDefaults, kPandocMetadata]
          .includes(key)
      ) {
        // move the key into the appropriate top level key
        if (kRenderDefaultsKeys.includes(key)) {
          format.render = format.render || {};
          format.render[key] = format[key];
        } else if (kComputeDefaultsKeys.includes(key)) {
          format.compute = format.compute || {};
          format.compute[key] = format[key];
        } else if (kPandocDefaultsKeys.includes(key)) {
          format.pandoc = format.pandoc || {};
          format.pandoc[key] = format[key];
        } else {
          format.metadata[key] = format[key];
        }
        // remove the key (since we moved it)
        delete format[key];
      }
    });
  }

  // merge user config into default config
  format = mergeConfigs(defaultWriterFormat(to), format);

  // force keep_md and keep_tex if we are in debug mode
  if (debug) {
    format.render = format.render || {};
    format.render[kKeepMd] = true;
    format.render[kKeepTex] = true;
  }

  return format;
}
