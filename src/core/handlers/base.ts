import {
  LanguageCellHandlerContext,
  LanguageCellHandlerOptions,
  LanguageHandler,
  PandocIncludeType,
} from "./types.ts";
import { breakQuartoMd, QuartoMdCell } from "../lib/break-quarto-md.ts";
import { MappedExecuteResult, PandocIncludes } from "../../execute/types.ts";
import { mergeConfigs } from "../config.ts";
import {
  DependencyFile,
  FormatExtras,
  kDependencies,
} from "../../config/types.ts";
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
  pandocFigCaption,
  pandocFigure,
  pandocHtmlBlock,
  pandocRawStr,
} from "../pandoc/codegen.ts";

import {
  kCapLoc,
  kCellClasses,
  kCellColumn,
  kCellFigAlign,
  kCellFigAlt,
  kCellFigCap,
  kCellFigColumn,
  kCellFigEnv,
  kCellFigLink,
  kCellFigPos,
  kCellFigScap,
  kCellFigSubCap,
  kCellLabel,
  kCellLstCap,
  kCellLstLabel,
  kCellPanel,
  kCellTblColumn,
  kCodeFold,
  kCodeLineNumbers,
  kCodeOverflow,
  kCodeSummary,
  kEcho,
  kFigCapLoc,
  kOutput,
  kTblCapLoc,
} from "../../config/constants.ts";
import { ComponentCell } from "../lib/break-quarto-md-types.ts";

const handlers: Record<string, LanguageHandler> = {};

interface HandlerContextResults {
  includes: PandocIncludes;
  resourceFiles: string[];
  extras: FormatExtras;
}

function makeHandlerContext(
  _executeResult: MappedExecuteResult,
  options: LanguageCellHandlerOptions,
): {
  context: LanguageCellHandlerContext;
  results?: HandlerContextResults;
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

export async function handleLanguageCells(
  executeResult: MappedExecuteResult,
  options: LanguageCellHandlerOptions,
): Promise<{
  markdown: MappedString;
  results?: HandlerContextResults;
}> {
  const mdCells =
    (await breakQuartoMd(asMappedString(executeResult.markdown), false))
      .cells;

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
    if (language !== "_component" && handlers[language] === undefined) {
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
  let results: HandlerContextResults | undefined = undefined;

  for (const [language, cells] of Object.entries(languageCellsPerLanguage)) {
    if (language === "_component") {
      // if this is a component, the semantics are that each the _contents_ of the cell
      // are first treated as if they were an entire markdown document that will be fully
      // parsed/handled etc. The _resulting_ markdown is then sent for handling by the
      // component handler
      for (const cell of cells) {
        const localExecuteResult = {
          ...executeResult,
          markdown: cell.source.source,
        };
        const localCellHandlerOptions = {
          ...options,
          markdown: cell.source.source,
        };

        // recurse
        const {
          markdown: localMarkdown,
          results: localResults,
        } = await handleLanguageCells(
          localExecuteResult,
          localCellHandlerOptions,
        );

        const componentCellType = cell.source.cell_type as ComponentCell;
        const innerLanguage = componentCellType.tag;
        const innerLanguageHandler = handlers[innerLanguage]!;

        // set results of component recursion
        if (results === undefined) {
          results = localResults;
        } else {
          results = mergeConfigs(results, localResults);
        }

        if (
          innerLanguageHandler === undefined ||
          innerLanguageHandler.handlerType === "cell"
        ) {
          // if no handler is present, just reconstitute
          // the tags and return.
          newCells[cell.index] = mappedConcat([
            componentCellType.sourceOpenTag,
            localMarkdown,
            componentCellType.sourceCloseTag,
          ]);
        } else {
          // call specific handler
          const innerHandler = makeHandlerContext(executeResult, {
            ...options,
            name: innerLanguage,
          });

          const innerMdCell = {
            ...cell.source,
            source: localMarkdown,
          };

          const transformedCell = innerLanguageHandler.document(
            innerHandler.context,
            [innerMdCell],
          )[0];
          newCells[cell.index] = transformedCell;

          if (results === undefined) {
            results = innerHandler.results;
          } else {
            results = mergeConfigs(results, innerHandler.results);
          }
        }
      }
    } else {
      const handler = makeHandlerContext(executeResult, {
        ...options,
        name: language,
      });
      const languageHandler = handlers[language];
      if (
        languageHandler !== undefined &&
        languageHandler.handlerType !== "component"
      ) {
        const transformedCells = languageHandler.document(
          handler.context,
          cells.map((x) => x.source),
        );
        for (let i = 0; i < transformedCells.length; ++i) {
          newCells[cells[i].index] = transformedCells[i];
        }
        if (results === undefined) {
          results = handler.results;
        } else {
          results = mergeConfigs(results, handler.results);
        }
      }
    }
  }
  return {
    markdown: mappedJoin(newCells, ""),
    results,
  };
}

export const baseHandler: LanguageHandler = {
  handlerType: "any",

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
    const options = mergeConfigs(this.defaultOptions ?? {}, cell.options ?? {});

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
    const hasFigureLabel = () => {
      if (!cell.options?.label) {
        return false;
      }
      return (cell.options.label as string).startsWith("fig-");
    };

    const { classes, attrs } = getDivAttributes(cell);

    const q3 = hasFigureLabel() ? pandocBlock(":::") : pandocFigure;
    const t3 = pandocBlock("```");
    const t4 = pandocBlock("````");
    const cellBlock = q3({
      classes: ["cell", ...classes],
      attrs,
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

    if (cell.options?.[kCellFigCap]) {
      if (hasFigureLabel()) {
        cellBlock.push(pandocRawStr(cell.options[kCellFigCap] as string));
      } else {
        const cap = pandocFigCaption();
        cap.push(pandocRawStr(cell.options[kCellFigCap] as string));
        cellBlock.push(cap);
      }
    }

    return cellBlock.mappedString();
  },
};

export function getDivAttributes(
  cell: QuartoMdCell,
): { attrs: string[]; classes: string[] } {
  const attrs: string[] = [];

  const keysToNotSerialize = new Set([
    kEcho,
    kCellLabel,
    kCellFigCap,
    kCellFigSubCap,
    kCellFigScap,
    kCapLoc,
    kFigCapLoc,
    kTblCapLoc,
    kCellFigColumn,
    kCellTblColumn,
    kCellFigLink,
    kCellFigAlign,
    kCellFigEnv,
    kCellFigPos,
    kCellFigAlt, // FIXME see if it's possible to do this right wrt accessibility
    kOutput,
    kCellLstCap,
    kCellLstLabel,
    kCodeFold,
    kCodeLineNumbers,
    kCodeSummary,
    kCodeOverflow,
    kCellClasses,
    kCellPanel,
    kCellColumn,
    "include.hidden",
    "source.hidden",
    "plot.hidden",
    "output.hidden",
    "echo.hidden",
  ]);

  for (const [key, value] of Object.entries(cell.options || {})) {
    if (!keysToNotSerialize.has(key)) {
      const t = typeof value;
      if (t === "object") {
        attrs.push(`${key}="${JSON.stringify(value)}"`);
      } else if (t === "string") {
        attrs.push(`${key}=${JSON.stringify(value)}`);
      } else if (t === "number") {
        attrs.push(`${key}="${value}"`);
      } else if (t === "boolean") {
        attrs.push(`${key}=${value}`);
      } else {
        throw new Error(`Can't serialize yaml metadata value of type ${t}`);
      }
    }
  }
  if (cell.options?.[kCellLstCap]) {
    attrs.push(`caption="${cell.options?.[kCellLstCap]}"`);
  }
  const classes = (cell.options?.classes as (undefined | string[])) || [];
  if (typeof cell.options?.panel === "string") {
    classes.push(`panel-${cell.options?.panel}`);
  }
  if (typeof cell.options?.column === "string") {
    classes.push(`column-${cell.options?.column}`);
  }
  if (typeof cell.options?.[kCapLoc] === "string") {
    classes.push(`caption-${cell.options?.[kCapLoc]}`);
  }
  if (typeof cell.options?.[kFigCapLoc] === "string") {
    classes.push(`fig-cap-location-${cell.options?.[kFigCapLoc]}`);
  }
  if (typeof cell.options?.[kTblCapLoc] === "string") {
    classes.push(`tbl-cap-location-${cell.options?.[kTblCapLoc]}`);
  }
  if (typeof cell.options?.[kCellFigColumn] === "string") {
    classes.push(`fig-caption-${cell.options?.[kCellFigColumn]}`);
  }
  if (typeof cell.options?.[kCellTblColumn] === "string") {
    classes.push(`fig-caption-${cell.options?.[kCellTblColumn]}`);
  }
  return { attrs, classes };
}
