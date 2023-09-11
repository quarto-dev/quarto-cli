/*
 * engine.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname, join } from "path/mod.ts";

import * as ld from "../core/lodash.ts";

import {
  partitionYamlFrontMatter,
  readYamlFromMarkdown,
} from "../core/yaml.ts";
import { dirAndStem } from "../core/path.ts";

import { metadataAsFormat } from "../config/metadata.ts";
import { kBaseFormat, kEngine } from "../config/constants.ts";

import { knitrEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter/jupyter.ts";
import { kMdExtensions, markdownEngine } from "./markdown.ts";
import { ExecutionEngine, kQmdExtensions } from "./types.ts";
import { languagesInMarkdown } from "./engine-shared.ts";
import { languages as handlerLanguages } from "../core/handlers/base.ts";
import { MappedString } from "../core/lib/text-types.ts";
import { RenderContext, RenderFlags } from "../command/render/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { ProjectContext } from "../project/types.ts";
import { pandocBuiltInFormats } from "../core/pandoc/pandoc-formats.ts";

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

export function executionEngineKeepMd(context: RenderContext) {
  const { input } = context.target;
  const baseFormat = context.format.identifier[kBaseFormat] || "html";
  const keepSuffix = `.${baseFormat}.md`;
  if (!input.endsWith(keepSuffix)) {
    const [dir, stem] = dirAndStem(input);
    return join(dir, stem + keepSuffix);
  }
}

// for the project crawl
export function executionEngineIntermediateFiles(
  engine: ExecutionEngine,
  input: string,
) {
  // all files of the form e.g. .html.md or -html.md are interemediate
  const files: string[] = [];
  const [dir, stem] = dirAndStem(input);
  files.push(
    ...pandocBuiltInFormats()
      .flatMap((format) => [`-${format}.md`, `.${format}.md`])
      .map((suffix) => join(dir, stem + suffix)),
  );

  // additional engine-specific intermediates (e.g. .ipynb for jupyter)
  const engineKeepFiles = engine.intermediateFiles
    ? engine.intermediateFiles(input)
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

export function markdownExecutionEngine(markdown: string, flags?: RenderFlags) {
  // read yaml and see if the engine is declared in yaml
  // (note that if the file were a non text-file like ipynb
  //  it would have already been claimed via extension)
  const result = partitionYamlFrontMatter(markdown);
  if (result) {
    let yaml = readYamlFromMarkdown(result.yaml);
    if (yaml) {
      // merge in command line fags
      yaml = mergeConfigs(yaml, flags?.metadata);
      for (const engine of kEngines) {
        if (yaml[engine.name]) {
          return engine;
        }
        const format = metadataAsFormat(yaml);
        if (format.execute?.[kEngine] === engine.name) {
          return engine;
        }
      }
    }
  }

  // if there are languages see if any engines want to claim them
  const languages = languagesInMarkdown(markdown);

  // see if there is an engine that claims this language
  for (const language of languages) {
    for (const engine of kEngines) {
      if (engine.claimsLanguage(language)) {
        return engine;
      }
    }
  }

  const handlerLanguagesVal = handlerLanguages();
  // if there is a non-cell handler language then this must be jupyter
  for (const language of languages) {
    if (language !== "ojs" && !handlerLanguagesVal.includes(language)) {
      return jupyterEngine;
    }
  }

  // if there is no computational engine discovered then bind
  // to the markdown engine;
  return markdownEngine;
}

/**
 * return the reason an execution engine could claim this file. This is
 * used to determine if the engine should be resolved again after
 * running pre-engine handlers.
 *
 * @param file filename
 * @returns the reason
 */
export function fileEngineClaimReason(file: string) {
  // get the extension and validate that it can be handled by at least one of our engines
  const ext = extname(file).toLowerCase();
  if (!kEngines.some((engine) => engine.validExtensions().includes(ext))) {
    return "invalid";
  }

  // try to find an engine that claims this extension outright
  for (const engine of kEngines) {
    if (engine.claimsFile(file, ext)) {
      return "extension";
    }
  }

  return "markdown";
}

export function fileExecutionEngine(
  file: string,
  flags?: RenderFlags,
  markdown?: MappedString,
) {
  // get the extension and validate that it can be handled by at least one of our engines
  const ext = extname(file).toLowerCase();
  if (!kEngines.some((engine) => engine.validExtensions().includes(ext))) {
    return undefined;
  }

  // try to find an engine that claims this extension outright
  for (const engine of kEngines) {
    if (engine.claimsFile(file, ext)) {
      return engine;
    }
  }

  // if we were passed a transformed markdown, use that for the text instead
  // of the contents of the file.
  if (kMdExtensions.includes(ext) || kQmdExtensions.includes(ext)) {
    return markdownExecutionEngine(
      markdown ? markdown.value : Deno.readTextFileSync(file),
      flags,
    );
  } else {
    return undefined;
  }
}

export async function fileExecutionEngineAndTarget(
  file: string,
  flags?: RenderFlags,
  markdown?: MappedString,
  project?: ProjectContext,
) {
  const engine = fileExecutionEngine(file, flags, markdown);
  if (!engine) {
    throw new Error("Unable to render " + file);
  }

  const target = await engine.target(file, flags?.quiet, markdown, project);
  if (!target) {
    throw new Error("Unable to render " + file);
  }

  return {
    engine,
    target,
  };
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
