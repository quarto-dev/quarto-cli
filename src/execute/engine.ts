/*
 * engine.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname, join } from "../deno_ral/path.ts";

import * as ld from "../core/lodash.ts";

import {
  partitionYamlFrontMatter,
  readYamlFromMarkdown,
} from "../core/yaml.ts";
import { dirAndStem } from "../core/path.ts";

import { metadataAsFormat } from "../config/metadata.ts";
import { kBaseFormat, kEngine } from "../config/constants.ts";

import { knitrEngineDiscovery } from "./rmd.ts";
import { jupyterEngineDiscovery } from "./jupyter/jupyter.ts";
import { ExternalEngine } from "../resources/types/schema-types.ts";
import { kMdExtensions, markdownEngineDiscovery } from "./markdown.ts";
import {
  ExecutionEngine,
  ExecutionEngineDiscovery,
  ExecutionEngineInstance,
  ExecutionTarget,
  kQmdExtensions,
} from "./types.ts";
import { languagesInMarkdown } from "./engine-shared.ts";
import { languages as handlerLanguages } from "../core/handlers/base.ts";
import { RenderContext, RenderFlags } from "../command/render/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { ProjectContext } from "../project/types.ts";
import { pandocBuiltInFormats } from "../core/pandoc/pandoc-formats.ts";
import { gitignoreEntries } from "../project/project-gitignore.ts";
import { juliaEngineDiscovery } from "./julia.ts";
import { ensureFileInformationCache } from "../project/project-shared.ts";
import { engineProjectContext } from "../project/engine-project-context.ts";
import { Command } from "cliffy/command/mod.ts";
import { quartoAPI } from "../core/quarto-api.ts";

const kEngines: Map<string, ExecutionEngineDiscovery> = new Map();

export function executionEngines(): ExecutionEngineDiscovery[] {
  return [...kEngines.values()];
}

export function executionEngine(name: string) {
  return kEngines.get(name);
}

// Register the standard engines with discovery interface
registerExecutionEngine(knitrEngineDiscovery);

// Register jupyter engine with discovery interface
registerExecutionEngine(jupyterEngineDiscovery);

// Register markdown engine with discovery interface
registerExecutionEngine(markdownEngineDiscovery);

registerExecutionEngine(juliaEngineDiscovery);

export function registerExecutionEngine(engine: ExecutionEngineDiscovery) {
  if (kEngines.has(engine.name)) {
    throw new Error(`Execution engine ${engine.name} already registered`);
  }
  kEngines.set(engine.name, engine);
  if (engine.init) {
    engine.init(quartoAPI);
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
  engine: ExecutionEngineInstance,
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

export function markdownExecutionEngine(
  project: ProjectContext,
  markdown: string,
  reorderedEngines: Map<string, ExecutionEngineDiscovery>,
  flags?: RenderFlags,
): ExecutionEngineInstance {
  // read yaml and see if the engine is declared in yaml
  // (note that if the file were a non text-file like ipynb
  //  it would have already been claimed via extension)
  const result = partitionYamlFrontMatter(markdown);
  if (result) {
    let yaml = readYamlFromMarkdown(result.yaml);
    if (yaml) {
      // merge in command line fags
      yaml = mergeConfigs(yaml, flags?.metadata);
      for (const [_, engine] of reorderedEngines) {
        if (yaml[engine.name]) {
          return engine.launch(engineProjectContext(project));
        }
        const format = metadataAsFormat(yaml);
        if (format.execute?.[kEngine] === engine.name) {
          return engine.launch(engineProjectContext(project));
        }
      }
    }
  }

  // if there are languages see if any engines want to claim them
  const languages = languagesInMarkdown(markdown);

  // see if there is an engine that claims this language
  for (const language of languages) {
    for (const [_, engine] of reorderedEngines) {
      if (engine.claimsLanguage(language)) {
        return engine.launch(engineProjectContext(project));
      }
    }
  }

  const handlerLanguagesVal = handlerLanguages();
  // if there is a non-cell handler language then this must be jupyter
  for (const language of languages) {
    if (language !== "ojs" && !handlerLanguagesVal.includes(language)) {
      return jupyterEngineDiscovery.launch(engineProjectContext(project));
    }
  }

  // if there is no computational engine discovered then bind
  // to the markdown engine;
  return markdownEngineDiscovery.launch(engineProjectContext(project));
}

async function reorderEngines(project: ProjectContext) {
  const userSpecifiedOrder: string[] = [];
  const projectEngines = project.config?.engines as
    | (string | ExternalEngine)[]
    | undefined;

  for (const engine of projectEngines ?? []) {
    if (typeof engine === "object") {
      try {
        const extEngine = (await import(engine.path))
          .default as ExecutionEngineDiscovery;
        userSpecifiedOrder.push(extEngine.name);
        kEngines.set(extEngine.name, extEngine);
        if (extEngine.init) {
          extEngine.init(quartoAPI);
        }
      } catch (err: any) {
        // Throw error for engine import failures as this is a serious configuration issue
        throw new Error(
          `Failed to import engine from ${engine.path}: ${
            err.message || "Unknown error"
          }`,
        );
      }
    } else {
      userSpecifiedOrder.push(engine);
    }
  }

  for (const key of userSpecifiedOrder) {
    if (!kEngines.has(key)) {
      throw new Error(
        `'${key}' was specified in the list of engines in the project settings but it is not a valid engine. Available engines are ${
          Array.from(kEngines.keys()).join(", ")
        }`,
      );
    }
  }

  const reorderedEngines = new Map<string, ExecutionEngineDiscovery>();

  // Add keys in the order of userSpecifiedOrder first
  for (const key of userSpecifiedOrder) {
    reorderedEngines.set(key, kEngines.get(key)!); // Non-null assertion since we verified the keys are in the map
  }

  // Add the rest of the keys from the original map
  for (const [key, value] of kEngines) {
    if (!reorderedEngines.has(key)) {
      reorderedEngines.set(key, value);
    }
  }

  return reorderedEngines;
}

export async function fileExecutionEngine(
  file: string,
  flags: RenderFlags | undefined,
  project: ProjectContext,
): Promise<ExecutionEngineInstance | undefined> {
  // get the extension and validate that it can be handled by at least one of our engines
  const ext = extname(file).toLowerCase();
  if (
    !(executionEngines().some((engine) =>
      engine.validExtensions().includes(ext)
    ))
  ) {
    return undefined;
  }

  const reorderedEngines = await reorderEngines(project);

  // try to find an engine that claims this extension outright
  for (const [_, engine] of reorderedEngines) {
    if (engine.claimsFile(file, ext)) {
      return engine.launch(engineProjectContext(project));
    }
  }

  // if we were passed a transformed markdown, use that for the text instead
  // of the contents of the file.
  if (kMdExtensions.includes(ext) || kQmdExtensions.includes(ext)) {
    const markdown = await project.resolveFullMarkdownForFile(undefined, file);
    // https://github.com/quarto-dev/quarto-cli/issues/6825
    // In case the YAML _parsing_ fails, we need to annotate the error
    // with the filename so that the user knows which file is the problem.
    try {
      return markdownExecutionEngine(
        project,
        markdown ? markdown.value : Deno.readTextFileSync(file),
        reorderedEngines,
        flags,
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;
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
  project: ProjectContext,
): Promise<{ engine: ExecutionEngineInstance; target: ExecutionTarget }> {
  const cached = ensureFileInformationCache(project, file);
  if (cached && cached.engine && cached.target) {
    return { engine: cached.engine, target: cached.target };
  }

  // Get the launched engine
  const engine = await fileExecutionEngine(file, flags, project);
  if (!engine) {
    throw new Error("Can't determine execution engine for " + file);
  }

  const markdown = await project.resolveFullMarkdownForFile(engine, file);
  const target = await engine.target(file, flags?.quiet, markdown);
  if (!target) {
    throw new Error("Can't determine execution target for " + file);
  }

  // Cache the ExecutionEngineInstance
  cached.engine = engine;
  cached.target = target;

  return { engine, target };
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

export const engineCommand = new Command()
  .name("engine")
  .description(
    `Access functionality specific to quarto's different rendering engines.`,
  )
  .action(() => {
    engineCommand.showHelp();
    Deno.exit(1);
  });

kEngines.forEach((engine, name) => {
  if (engine.populateCommand) {
    const engineSubcommand = new Command();
    // fill in some default behavior for each engine command
    engineSubcommand
      .description(
        `Access functionality specific to the ${name} rendering engine.`,
      )
      .action(() => {
        engineSubcommand.showHelp();
        Deno.exit(1);
      });
    engine.populateCommand(engineSubcommand);
    engineCommand.command(name, engineSubcommand);
  }
});
