import {
  LanguageCellHandlerContext,
  LanguageCellHandlerOptions,
  LanguageHandler,
  PandocIncludeType,
} from "./types.ts";
import { breakQuartoMd } from "../break-quarto-md.ts";
import { asMappedString } from "../mapped-text.ts";
import { ExecuteResult, PandocIncludes } from "../../execute/types.ts";
import { mergeConfigs } from "../config.ts";
import {
  DependencyFile,
  FormatExtras,
  kDependencies,
} from "../../config/types.ts";
import { resolveDependencies } from "../../command/render/pandoc.ts";
import { dirname } from "path/mod.ts";
import { kIncludeInHeader } from "../../config/constants.ts";

const handlers: Record<string, LanguageHandler> = {};

interface HandlerContextResults {
  includes: PandocIncludes;
  resourceFiles: string[];
  extras: FormatExtras;
}

function makeHandlerContext(
  _executeResult: ExecuteResult,
  options: LanguageCellHandlerOptions,
): {
  context: LanguageCellHandlerContext;
  results: HandlerContextResults;
} {
  const formatDependency = {
    name: options.name,
    version: options.version,
    scripts: [],
    stylesheets: [],
    resources: [],
  };
  const results: HandlerContextResults = {
    resourceFiles: [],
    includes: {},
    extras: {
      html: {
        [kDependencies]: [formatDependency],
      },
    },
  };
  const tempContext = options.temp;
  const context: LanguageCellHandlerContext = {
    options,
    addDependency(
      dependencyType: "script" | "stylesheet" | "resource",
      dependency: DependencyFile,
    ) {
      let lst: DependencyFile[];
      switch (dependencyType) {
        case "script":
          lst = formatDependency.scripts;
          break;
        case "stylesheet":
          lst = formatDependency.stylesheets;
          break;
        case "resource":
          lst = formatDependency.resources;
          break;
      }
      lst.push(dependency);
    },
    addResource(fileName: string) {
      results.resourceFiles.push(fileName);
    },
    addInclude(content: string, where: PandocIncludeType) {
      const fileName = tempContext.createFile();
      Deno.writeTextFileSync(fileName, content);
      if (results.includes[where] === undefined) {
        results.includes[where] = [fileName];
      } else {
        results.includes[where]!.push(fileName);
      }
    },
  };

  return { context, results };
}

export function languages(): string[] {
  return Object.keys(handlers);
}

export function install(language: string, handler: LanguageHandler) {
  handlers[language] = handler;
}

// this mutates executeResult!
export async function handleLanguageCells(
  executeResult: ExecuteResult,
  options: LanguageCellHandlerOptions,
) {
  const mdCells =
    (await breakQuartoMd(asMappedString(executeResult.markdown), false))
      .cells;
  const newCells: string[] = [];
  const languageCellsPerLanguage: Record<
    string,
    { index: number; source: string }[]
  > = {};

  for (let i = 0; i < mdCells.length; ++i) {
    const cell = mdCells[i];
    newCells.push(cell.sourceVerbatim.value);
    if (
      cell.cell_type === "math" ||
      cell.cell_type === "raw" ||
      cell.cell_type === "markdown"
    ) {
      continue;
    }
    const language = cell.cell_type.language;
    if (handlers[language] === undefined) {
      continue;
    }
    if (languageCellsPerLanguage[language] === undefined) {
      languageCellsPerLanguage[language] = [];
    }
    languageCellsPerLanguage[language].push({
      index: i,
      source: cell.source.value,
    });
  }
  for (const [language, cells] of Object.entries(languageCellsPerLanguage)) {
    const handler = makeHandlerContext(executeResult, {
      ...options,
      name: language,
    });
    const languageHandler = handlers[language]!;
    const transformedCells = languageHandler.document(
      handler.context,
      cells.map((cell) => cell.source),
    );
    for (let i = 0; i < transformedCells.length; ++i) {
      newCells[cells[i].index] = transformedCells[i];
    }
    if (executeResult.includes) {
      executeResult.includes = mergeConfigs(
        executeResult.includes,
        handler.results.includes,
      );
    } else {
      executeResult.includes = handler.results.includes;
    }
    const extras = resolveDependencies(
      handler.results.extras,
      dirname(options.source),
      options.libDir,
      options.temp,
    );
    if (extras[kIncludeInHeader]) {
      executeResult.includes[kIncludeInHeader] = [
        ...(executeResult.includes[kIncludeInHeader] || []),
        ...(extras[kIncludeInHeader] || []),
      ];
    }
  }

  executeResult.markdown = newCells.join("\n");
}
