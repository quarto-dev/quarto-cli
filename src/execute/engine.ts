/*
 * engine.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname, join, resolve } from "path/mod.ts";

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
import { gitignoreEntries } from "../project/project-gitignore.ts";

const kEngines: Map<string, ExecutionEngine> = new Map();

export function executionEngines(): ExecutionEngine[] {
  return [...kEngines.values()];
}

export function executionEngine(name: string) {
  return kEngines.get(name);
}

for (const engine of [knitrEngine, jupyterEngine, markdownEngine]) {
  registerExecutionEngine(engine);
}

export function registerExecutionEngine(engine: ExecutionEngine) {
  if (kEngines.has(engine.name)) {
    throw new Error(`Execution engine ${engine.name} already registered`);
  }
  kEngines.set(engine.name, engine);
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
  return ld.uniq(
    executionEngines().flatMap((engine) => engine.validExtensions()),
  );
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
      for (const [_, engine] of kEngines) {
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
    for (const [_, engine] of kEngines) {
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

export async function fileExecutionEngine(
  file: string,
  flags: RenderFlags | undefined,
  project: ProjectContext,
) {
  // get the extension and validate that it can be handled by at least one of our engines
  const ext = extname(file).toLowerCase();
  if (
    !(executionEngines().some((engine) =>
      engine.validExtensions().includes(ext)
    ))
  ) {
    return undefined;
  }

  // try to find an engine that claims this extension outright
  for (const [_, engine] of kEngines) {
    if (engine.claimsFile(file, ext)) {
      return engine;
    }
  }

  // if we were passed a transformed markdown, use that for the text instead
  // of the contents of the file.
  if (kMdExtensions.includes(ext) || kQmdExtensions.includes(ext)) {
    const markdown = await project.resolveFullMarkdownForFile(file);
    // https://github.com/quarto-dev/quarto-cli/issues/6825
    // In case the YAML _parsing_ fails, we need to annotate the error
    // with the filename so that the user knows which file is the problem.
    try {
      return markdownExecutionEngine(
        markdown ? markdown.value : Deno.readTextFileSync(file),
        flags,
      );
    } catch (error) {
      if (error.name === "YAMLError") {
        error.message = `${file}:\n${error.message}`;
      }
      throw error;
    }
  } else {
    return undefined;
  }
}

export async function fileExecutionEngineAndTarget(
  file: string,
  flags: RenderFlags | undefined,
  // markdown: MappedString | undefined,
  project: ProjectContext,
) {
  const cached = project.engineAndTargetCache?.get(file);
  if (cached) {
    return cached;
  }

  const engine = await fileExecutionEngine(file, flags, project);
  const markdown = await project.resolveFullMarkdownForFile(file);
  if (!engine) {
    throw new Error("Can't determine execution engine for " + file);
  }

  const target = await engine.target(file, flags?.quiet, markdown, project);
  if (!target) {
    throw new Error("Can't determine execution target for " + file);
  }

  const result = { engine, target };
  if (!project.engineAndTargetCache) {
    project.engineAndTargetCache = new Map();
  }
  project.engineAndTargetCache.set(file, result);
  return result;
}

export function engineIgnoreDirs() {
  const ignoreDirs: string[] = ["node_modules"];
  executionEngines().forEach((engine) => {
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

export function projectIgnoreGlobs(dir: string) {
  return engineIgnoreGlobs().concat(
    gitignoreEntries(dir).map((ignore) => `**/${ignore}**`),
  );
}
