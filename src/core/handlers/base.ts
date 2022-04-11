import {
  LanguageCellHandlerContext,
  LanguageCellHandlerOptions,
  LanguageHandler,
  PandocIncludeType,
} from "./types.ts";
import { breakQuartoMd, QuartoMdCell } from "../lib/break-quarto-md.ts";
import { ExecuteResult, PandocIncludes } from "../../execute/types.ts";
import { mergeConfigs } from "../config.ts";
import {
  DependencyFile,
  FormatExtras,
  kDependencies,
} from "../../config/types.ts";
import { resolveDependencies } from "../../command/render/pandoc.ts";
import { dirname } from "path/mod.ts";
import { kCodeFold, kIncludeInHeader } from "../../config/constants.ts";
import {
  asMappedString,
  join as mappedJoin,
  mappedConcat,
  mappedLines,
  MappedString,
} from "../lib/mapped-text.ts";
import {
  addLanguageComment,
  optionCommentPrefixFromLanguage,
} from "../lib/partition-cell-options.ts";
import { ConcreteSchema } from "../lib/yaml-schema/types.ts";
import {
  pandocBlock,
  pandocHtmlBlock,
  pandocRawStr,
} from "../pandoc/codegen.ts";

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

export async function languageSchema(
  language: string,
): Promise<ConcreteSchema | undefined> {
  if (handlers[language] === undefined) {
    return undefined;
  }
  const call = handlers[language].schema;
  if (call === undefined) {
    return undefined;
  } else {
    return (await call());
  }
}

export function install(handler: LanguageHandler) {
  const language = handler.languageName;
  handlers[language] = handler;
  if (handler.comment !== undefined) {
    addLanguageComment(language, handler.comment);
  }
}

// this mutates executeResult.markdown!
export async function handleLanguageCells(
  executeResult: ExecuteResult,
  options: LanguageCellHandlerOptions,
) {
  console.log("MARKDOWN BEFORE HANDLING");
  console.log(`<<<<<\n${executeResult.markdown}>>>>>\n`);

  const mdCells =
    (await breakQuartoMd(asMappedString(executeResult.markdown), false))
      .cells;

  console.log("MARKDOWN BEFORE CELLS:");
  for (const cell of mdCells) {
    console.log(`<<<<\n${cell.sourceVerbatim.value}>>>>\n`);
  }
  const newCells: MappedString[] = [];
  const languageCellsPerLanguage: Record<
    string,
    { index: number; source: QuartoMdCell }[]
  > = {};

  for (let i = 0; i < mdCells.length; ++i) {
    const cell = mdCells[i];
    newCells.push(cell.sourceVerbatim);
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
      source: cell,
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
      cells.map((x) => x.source),
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

  executeResult.markdown = mappedJoin(newCells, "\n").value;
}

export const baseHandler: LanguageHandler = {
  languageName:
    "<<<< baseHandler: languageName should have been overridden >>>>",

  defaultOptions: {
    echo: true,
  },

  document(
    handlerContext: LanguageCellHandlerContext,
    cells: QuartoMdCell[],
  ): MappedString[] {
    this.documentStart(handlerContext);
    const result = cells.map((cell) => this.cell(handlerContext, cell));
    this.documentEnd(handlerContext);
    return result;
  },

  // called once per document at the start of processing
  documentStart(
    _handlerContext: LanguageCellHandlerContext,
  ) {
  },

  // called once per document at the end of processing
  documentEnd(
    _handlerContext: LanguageCellHandlerContext,
  ) {
  },

  cell(
    _handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
  ): MappedString {
    return cell.sourceVerbatim;
  },

  // FIXME attributes we're not handling yet:
  // - code-summary
  // - code-overflow
  // - code-line-numbers
  //
  // FIXME how do we set up support for:
  // - things that include subfigures, like tables?
  //
  // FIXME how should we interpret the difference between output and eval
  // here?

  build(
    _handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    content: MappedString,
  ): MappedString {
    // FIXME this should get the project+document options as well.
    const options = mergeConfigs(this.defaultOptions, cell.options ?? {});

    // split content into front matter vs input
    const contentLines = mappedLines(cell.source, true);
    const frontMatterLines: MappedString[] = [];
    const comment: string = optionCommentPrefixFromLanguage(this.languageName);
    let inputIndex = 0;
    for (const contentLine of contentLines) {
      if (contentLine.value.startsWith(comment)) {
        if (contentLine.value.indexOf("echo: fenced") === -1) {
          frontMatterLines.push(contentLine);
        }
        ++inputIndex;
      } else {
        break;
      }
    }
    const inputLines = contentLines.slice(inputIndex);

    const q3 = pandocBlock(":::");
    const t3 = pandocBlock("```");
    const t4 = pandocBlock("````");
    const cellBlock = q3({
      classes: ["cell"],
    });

    const cellInputClasses = [
      this.languageClass ?? this.languageName,
      "cell-code",
      ...((options["class-source"] as (string[] | undefined)) ?? []),
    ];
    const cellInputAttrs: string[] = [
      ...((options["attr-source"] as (string[] | undefined)) ?? []),
    ];
    const cellOutputClasses = [
      "cell-output-display",
      ...((options["class-output"] as (string[] | undefined)) ?? []),
    ];
    const cellOutputAttrs: string[] = [
      ...((options["attr-output"] as (string[] | undefined)) ?? []),
    ];

    if (options[kCodeFold] !== undefined) {
      cellOutputAttrs.push(`code-fold="${options[kCodeFold]}"`);
    }

    switch (options.echo) {
      case true: {
        const cellInput = t3({
          classes: cellInputClasses,
          attrs: cellInputAttrs,
        });
        cellInput.push(pandocRawStr(mappedConcat(inputLines)));
        cellBlock.push(cellInput);
        break;
      }
      case "fenced": {
        const cellInput = t4({
          classes: ["markdown", ...cellInputClasses.slice(1)], // replace the language class with markdown
          attrs: cellInputAttrs,
        });
        const cellFence = t3({
          language: this.languageName,
        });
        const fencedInput = mappedConcat([
          ...frontMatterLines,
          ...inputLines,
        ]);
        cellFence.push(pandocRawStr(fencedInput));
        cellInput.push(cellFence);
        cellBlock.push(cellInput);
        break;
      }
    }

    if (options.eval === true) {
      const cellOutput = pandocHtmlBlock("div")({
        attrs: cellOutputAttrs,
        classes: cellOutputClasses,
      });
      cellOutput.push(pandocRawStr(content));
      cellBlock.push(cellOutput);
    }

    return cellBlock.mappedString();
  },
};
