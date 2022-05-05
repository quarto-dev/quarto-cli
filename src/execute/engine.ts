/*
* engine.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname, join } from "path/mod.ts";

import * as ld from "../core/lodash.ts";

import {
  partitionYamlFrontMatter,
  readYamlFromMarkdown,
} from "../core/yaml.ts";
import { dirAndStem } from "../core/path.ts";

import { metadataAsFormat } from "../config/metadata.ts";
import { kEngine } from "../config/constants.ts";

import { knitrEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter/jupyter.ts";
import { markdownEngine } from "./markdown.ts";
import { ExecutionEngine } from "./types.ts";
import { languagesInMarkdown } from "./engine-shared.ts";
import { MappedString } from "../core/lib/text-types.ts";

const kEngines: ExecutionEngine[] = [
  knitrEngine,
  jupyterEngine,
  markdownEngine,
];

export function executionEngines() {
  return kEngines.map((engine) => engine.name);
}

export function executionEngine(name: string) {
  // try to find an engine
  for (const engine of kEngines) {
    if (engine.name === name) {
      return engine;
    }
  }
}

export function executionEngineKeepMd(input: string) {
  const keepSuffix = `.md`;
  if (!input.endsWith(keepSuffix)) {
    const [dir, stem] = dirAndStem(input);
    return join(dir, stem + keepSuffix);
  }
}

export function executionEngineKeepFiles(
  engine: ExecutionEngine,
  input: string,
) {
  // standard keepMd
  const files: string[] = [];
  const keep = executionEngineKeepMd(input);
  if (keep) {
    files.push(keep);
  }

  // additional files
  const engineKeepFiles = engine.keepFiles
    ? engine.keepFiles(input)
    : undefined;
  if (engineKeepFiles) {
    return files.concat(engineKeepFiles);
  } else {
    return files;
  }
}

export function engineValidExtensions(): string[] {
  return ld.uniq(kEngines.flatMap((engine) => engine.validExtensions()));
}

export function markdownExecutionEngine(
  markdown: string,
) {
  // read yaml and see if the engine is declared in yaml
  // (note that if the file were a non text-file like ipynb
  //  it would have already been claimed via extension)
  const result = partitionYamlFrontMatter(markdown);
  if (result) {
    const yaml = readYamlFromMarkdown(result.yaml);
    if (yaml) {
      for (const engine of kEngines) {
        if (yaml[engine.name]) {
          return engine;
        }
        const format = metadataAsFormat(yaml);
        if (
          format.execute?.[kEngine] === engine.name
        ) {
          return engine;
        }
      }
    }
  }

  // if there are languages see if any engines want to claim them
  const languages = languagesInMarkdown(markdown);
  if (languages.size > 0) {
    for (const language of languages) {
      for (const engine of kEngines) {
        if (engine.claimsLanguage(language)) {
          return engine;
        }
      }
    }

    // if there is no language or just ojs then it's plain markdown
    // or the knitr engine if there are inline r expressions
    if (
      languages.size === 0 ||
      (languages.size == 1 && languages.has("ojs"))
    ) {
      return engineForMarkdownWithNoLanguages(markdown);
    } else {
      return jupyterEngine;
    }
  } else {
    return engineForMarkdownWithNoLanguages(markdown);
  }
}

/**
 * return the reason an execution engine could claim this file. This is
 * used to determine if the engine should be resolved again after
 * running pre-engine handlers.
 *
 * @param file filename
 * @returns the reason
 */
export function fileEngineClaimReason(
  file: string,
) {
  // get the extension and validate that it can be handled by at least one of our engines
  const ext = extname(file).toLowerCase();
  if (!kEngines.some((engine) => engine.validExtensions().includes(ext))) {
    return "invalid";
  }

  // try to find an engine that claims this extension outright
  for (const engine of kEngines) {
    if (engine.claimsExtension(ext)) {
      return "extension";
    }
  }

  return "markdown";
}

export function fileExecutionEngine(
  file: string,
) {
  // get the extension and validate that it can be handled by at least one of our engines
  const ext = extname(file).toLowerCase();
  if (!kEngines.some((engine) => engine.validExtensions().includes(ext))) {
    return undefined;
  }

  // try to find an engine that claims this extension outright
  for (const engine of kEngines) {
    if (engine.claimsExtension(ext)) {
      return engine;
    }
  }

  return markdownExecutionEngine(Deno.readTextFileSync(file));
}

export async function fileExecutionEngineAndTarget(
  file: string,
  quiet?: boolean,
  markdown?: MappedString,
) {
  const engine = fileExecutionEngine(file);
  if (!engine) {
    throw new Error("Unable to render " + file);
  }

  const target = await engine.target(file, quiet, markdown);
  if (!target) {
    throw new Error("Unable to render " + file);
  }

  return {
    engine,
    target,
  };
}

function engineForMarkdownWithNoLanguages(markdown: string) {
  if (markdown.match(/`r[ #]([^`]+)\s*`/)) {
    return knitrEngine;
  } else {
    return markdownEngine;
  }
}

export function engineIgnoreDirs() {
  const ignoreDirs: string[] = ["node_modules"];
  executionEngines().forEach((name) => {
    const engine = executionEngine(name);
    if (engine && engine.ignoreDirs) {
      const ignores = engine.ignoreDirs();
      if (ignores) {
        ignoreDirs.push(...ignores);
      }
    }
  });
  return ignoreDirs;
}

export function engineIgnoreGlobs() {
  return engineIgnoreDirs().map((ignore) => `**/${ignore}/**`);
}
