import {
  HandlerContextResults,
  LanguageCellHandlerContext,
  LanguageCellHandlerOptions,
  LanguageHandler,
  PandocIncludeType,
} from "./types.ts";
import { breakQuartoMd, QuartoMdCell } from "../lib/break-quarto-md.ts";
import { PandocIncludes } from "../../execute/types.ts";
import { mergeConfigs } from "../config.ts";
import {
  DependencyFile,
  FormatDependency,
  FormatExtras,
  kDependencies,
} from "../../config/types.ts";
import {
  join as mappedJoin,
  mappedConcat,
  mappedLines,
  mappedReplace,
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
import { isHtmlCompatible } from "../../config/format.ts";

const handlers: Record<string, LanguageHandler> = {};

function makeHandlerContext(
  options: LanguageCellHandlerOptions,
): {
  context: LanguageCellHandlerContext;
  results?: HandlerContextResults;
} {
  const results: HandlerContextResults = {
    resourceFiles: [],
    includes: {},
    extras: {},
  };
  const tempContext = options.temp;
  const context: LanguageCellHandlerContext = {
    options,
    addHtmlDependency(
      dependencyType: "script" | "stylesheet" | "resource",
      dependency: DependencyFile,
      dependencyName?: string,
      dependencyVersion?: string,
    ) {
      if (!isHtmlCompatible(options.format)) {
        throw new Error("addDepdendency only supported in html formats");
      }
      dependencyName = dependencyName || options.name;
      const dep: FormatDependency = {
        name: dependencyName,
        version: dependencyVersion,
      };
      switch (dependencyType) {
        case "script":
          dep.scripts = [dependency];
          break;
        case "stylesheet":
          dep.stylesheets = [dependency];
          break;
        case "resource":
          dep.resources = [dependency];
          break;
      }
      if (results.extras.html === undefined) {
        results.extras.html = { [kDependencies]: [dep] };
      } else {
        results.extras.html[kDependencies]!.push(dep);
      }
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
  options: LanguageCellHandlerOptions,
): Promise<{
  markdown: MappedString;
  results?: HandlerContextResults;
}> {
  const mdCells = (await breakQuartoMd(options.markdown, false))
    .cells;

  if (mdCells.length === 0) {
    return {
      markdown: options.markdown,
    };
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
    if (language !== "_component" && handlers[language] === undefined) {
      continue;
    }
    if (
      handlers[language]?.stage &&
      handlers[language].stage !== "any" &&
      options.stage !== handlers[language].stage
    ) {
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
        const localCellHandlerOptions = {
          ...options,
          markdown: cell.source.source,
        };

        const componentCellType = cell.source.cell_type as ComponentCell;
        const innerLanguage = componentCellType.tag;
        const innerLanguageHandler = handlers[innerLanguage]!;

        if (
          innerLanguageHandler &&
          (innerLanguageHandler.stage !== "any" &&
            innerLanguageHandler.stage !== options.stage)
        ) { // we're in the wrong stage, so we don't actually do anything
          if (componentCellType.sourceOpenTag.value.trim().endsWith("/>")) { // empty component, it's a single line
            newCells[cell.index] = componentCellType.sourceOpenTag;
          } else {
            newCells[cell.index] = mappedConcat(
              [
                componentCellType.sourceOpenTag,
                localCellHandlerOptions.markdown,
                componentCellType.sourceCloseTag,
              ],
            );
            continue;
          }
        }

        // recurse
        const {
          markdown: localMarkdown,
          results: localResults,
        } = await handleLanguageCells(
          localCellHandlerOptions,
        );

        // set results of component recursion
        results = mergeConfigs(results, localResults);

        if (
          innerLanguageHandler === undefined ||
          innerLanguageHandler.type === "cell"
        ) {
          // if no handler is present, just create a div tag
          // tag and return.
          const missingTagStartTag = mappedReplace(
            componentCellType.sourceOpenTag,
            new RegExp(`<${componentCellType.tag}`),
            `<div quarto-component="${componentCellType.tag}"`,
          );
          if (componentCellType.sourceOpenTag.value.trim().endsWith("/>")) {
            newCells[cell.index] = missingTagStartTag;
          } else {
            newCells[cell.index] = mappedConcat(
              [
                missingTagStartTag,
                localMarkdown,
                componentCellType.sourceCloseTag,
              ],
            );
          }
          continue;
        }

        // call specific handler
        const innerHandler = makeHandlerContext({
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

        results = mergeConfigs(results, innerHandler.results);
      }
    } else {
      const handler = makeHandlerContext({
        ...options,
        name: language,
      });
      const languageHandler = handlers[language];
      if (
        languageHandler !== undefined &&
        languageHandler.type !== "component"
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
  type: "any",
  stage: "any",

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
    const result = cells.map((cell) => {
      return this.cell(
        handlerContext,
        cell,
        // FIXME this should get the project+document options as well.
        mergeConfigs(this.defaultOptions ?? {}, cell.options ?? {}),
      );
    });
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
    _options: Record<string, unknown>,
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
    options: Record<string, unknown>,
  ): MappedString {
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
