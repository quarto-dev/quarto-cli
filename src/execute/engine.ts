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

import { knitrEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter/jupyter.ts";
import { ExternalEngine } from "../resources/types/schema-types.ts";
import { kMdExtensions, markdownEngineDiscovery } from "./markdown.ts";
import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  ExecutionEngineDiscovery,
  LaunchedExecutionEngine,
  PostProcessOptions,
  kQmdExtensions
} from "./types.ts";
import { languagesInMarkdown } from "./engine-shared.ts";
import { languages as handlerLanguages } from "../core/handlers/base.ts";
import { RenderContext, RenderFlags } from "../command/render/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { MappedString } from "../core/mapped-text.ts";
import { EngineProjectContext, ProjectContext } from "../project/types.ts";
import { pandocBuiltInFormats } from "../core/pandoc/pandoc-formats.ts";
import { gitignoreEntries } from "../project/project-gitignore.ts";
import { juliaEngine } from "./julia.ts";
import { ensureFileInformationCache } from "../project/project-shared.ts";
import { engineProjectContext } from "../project/engine-project-context.ts";
import { asLaunchedEngine } from "./as-launched-engine.ts";
import { Command } from "cliffy/command/mod.ts";

const kEngines: Map<string, ExecutionEngine> = new Map();

export function executionEngines(): ExecutionEngine[] {
  return [...kEngines.values()];
}

export function executionEngine(name: string) {
  return kEngines.get(name);
}

// Register the standard engines
registerExecutionEngine(knitrEngine);
registerExecutionEngine(jupyterEngine);
registerExecutionEngine(juliaEngine);

// Register markdownEngine using the new discovery/launch pattern
registerExecutionEngine({
  ...markdownEngineDiscovery,

  // Legacy methods for backward compatibility
  markdownForFile: (file: string) => {
    const context = engineProjectContext({} as ProjectContext);
    const launchedEngine = markdownEngineDiscovery.launch(context);
    return launchedEngine.markdownForFile(file);
  },

  target: (file: string, quiet?: boolean, markdown?: MappedString, project?: ProjectContext) => {
    if (!project) {
      throw new Error("Project context required for markdownEngine.target");
    }
    const context = engineProjectContext(project);
    const launchedEngine = markdownEngineDiscovery.launch(context);
    return launchedEngine.target(file, quiet, markdown);
  },

  partitionedMarkdown: (file: string) => {
    const context = engineProjectContext({} as ProjectContext);
    const launchedEngine = markdownEngineDiscovery.launch(context);
    return launchedEngine.partitionedMarkdown(file);
  },

  execute: (options: ExecuteOptions) => {
    const context = engineProjectContext(options.project);
    const launchedEngine = markdownEngineDiscovery.launch(context);
    return launchedEngine.execute(options);
  },

  dependencies: (options: DependenciesOptions) => {
    const context = engineProjectContext({} as ProjectContext);
    const launchedEngine = markdownEngineDiscovery.launch(context);
    return launchedEngine.dependencies(options);
  },

  postprocess: (options: PostProcessOptions) => {
    const context = engineProjectContext({} as ProjectContext);
    const launchedEngine = markdownEngineDiscovery.launch(context);
    return launchedEngine.postprocess(options);
  }
});

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

export function markdownExecutionEngine(
  markdown: string,
  reorderedEngines: Map<string, ExecutionEngine>,
  flags?: RenderFlags,
) {
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
    for (const [_, engine] of reorderedEngines) {
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

async function reorderEngines(project: ProjectContext) {
  const userSpecifiedOrder: string[] = [];
  const projectEngines = project.config?.engines as
    | (string | ExternalEngine)[]
    | undefined;

  for (const engine of projectEngines ?? []) {
    if (typeof engine === "object") {
      const extEngine = (await import(engine.url)).default as ExecutionEngine;
      userSpecifiedOrder.push(extEngine.name);
      kEngines.set(extEngine.name, extEngine);
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

  const reorderedEngines = new Map<string, ExecutionEngine>();

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

  const reorderedEngines = await reorderEngines(project);

  // try to find an engine that claims this extension outright
  for (const [_, engine] of reorderedEngines) {
    if (engine.claimsFile(file, ext)) {
      return engine;
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
) {
  const cached = ensureFileInformationCache(project, file);
  if (cached && cached.engine && cached.target) {
    return { engine: cached.engine, target: cached.target };
  }

  // Get the discovery engine
  const discoveryEngine = await fileExecutionEngine(file, flags, project);
  if (!discoveryEngine) {
    throw new Error("Can't determine execution engine for " + file);
  }

  // Create engine project context
  const context = engineProjectContext(project);

  // Launch the engine (using adapter for legacy engines or direct launch for markdownEngine)
  const launchedEngine = discoveryEngine.name === markdownEngineDiscovery.name
    ? markdownEngineDiscovery.launch(context)
    : asLaunchedEngine(discoveryEngine, context);

  const markdown = await project.resolveFullMarkdownForFile(discoveryEngine, file);
  const target = await launchedEngine.target(file, flags?.quiet, markdown);
  if (!target) {
    throw new Error("Can't determine execution target for " + file);
  }

  // Cache the LaunchedExecutionEngine
  cached.engine = launchedEngine;
  cached.target = target;

  return { engine: launchedEngine, target };
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
