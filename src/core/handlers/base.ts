/*
 * base.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import {
  HandlerContextResults,
  LanguageCellHandlerContext,
  LanguageCellHandlerOptions,
  LanguageHandler,
  PandocIncludeType,
} from "./types.ts";
import { breakQuartoMd, QuartoMdCell } from "../lib/break-quarto-md.ts";
import { mergeConfigs } from "../config.ts";
import { FormatDependency, kDependencies } from "../../config/types.ts";
import {
  asMappedString,
  join as mappedJoin,
  mappedConcat,
  mappedLines,
  MappedString,
  mappedTrim,
} from "../lib/mapped-text.ts";
import {
  addLanguageComment,
  optionCommentPatternFromLanguage,
} from "../lib/partition-cell-options.ts";
import { ConcreteSchema } from "../lib/yaml-schema/types.ts";
import { pandocBlock, pandocList, pandocRawStr } from "../pandoc/codegen.ts";

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
  kFigAlign,
  kFigCapLoc,
  kLayout,
  kLayoutNcol,
  kLayoutNrow,
  kOutput,
  kTblCapLoc,
} from "../../config/constants.ts";
import { DirectiveCell } from "../lib/break-quarto-md-types.ts";
import { basename, dirname, join, relative, resolve } from "path/mod.ts";
import { figuresDir, inputFilesDir } from "../render.ts";
import { ensureDirSync } from "fs/mod.ts";
import { mappedStringFromFile } from "../mapped-text.ts";
import { error } from "log/mod.ts";
import { withCriClient } from "../cri/cri.ts";
import { normalizePath } from "../path.ts";
import { isBlockShortcode } from "../lib/parse-shortcode.ts";
import { standaloneInclude } from "./include-standalone.ts";

const handlers: Record<string, LanguageHandler> = {};

let globalFigureCounter: Record<string, number> = {};

export function resetFigureCounter() {
  globalFigureCounter = {};
}

function makeHandlerContext(
  options: LanguageCellHandlerOptions,
): {
  context: LanguageCellHandlerContext;
  results?: HandlerContextResults;
} {
  if (options.state === undefined) {
    // we mutate the parameter here so this works with the sharing of options
    // in nested handler context calls (which can arise when handling directives)
    options.state = {};
  }
  const results: HandlerContextResults = {
    resourceFiles: [],
    includes: {},
    extras: {},
    supporting: [],
  };
  const tempContext = options.temp;
  const context: LanguageCellHandlerContext = {
    options,

    getState(): Record<string, unknown> {
      if (options.state![options.name] === undefined) {
        options.state![options.name] = {};
      }
      return options.state![options.name];
    },

    async extractHtml(opts: {
      html: string;
      selector: string;
      resources?: [string, string][];
    }): Promise<string[]> {
      const {
        html: content,
        selector,
      } = opts;
      const nonEmptyHtmlResources: [string, string][] = opts.resources ||
        [];
      const dirName = context.options.temp.createDir();
      // create temporary resources
      for (const [name, content] of nonEmptyHtmlResources) {
        Deno.writeTextFileSync(join(dirName, name), content);
      }
      const fileName = join(dirName, "index.html");
      Deno.writeTextFileSync(fileName, content);
      const url = `file://${fileName}`;

      return await withCriClient(async (client) => {
        await client.open(url);
        return await client.contents(selector);
      });
    },

    async createPngsFromHtml(opts: {
      prefix: string;
      html: string;
      deviceScaleFactor: number;
      selector: string;
      resources?: [string, string][];
    }): Promise<{
      filenames: string[];
      elements: string[];
    }> {
      const {
        prefix,
        html: content,
        deviceScaleFactor,
        selector,
      } = opts;
      const nonEmptyHtmlResources: [string, string][] = opts.resources ||
        [];
      const dirName = context.options.temp.createDir();

      // create temporary resources
      for (const [name, content] of nonEmptyHtmlResources) {
        Deno.writeTextFileSync(join(dirName, name), content);
      }
      const fileName = join(dirName, "index.html");
      Deno.writeTextFileSync(fileName, content);
      const url = `file://${fileName}`;

      const { elements, images } = await withCriClient(async (client) => {
        await client.open(url);
        const elements = await client.contents(selector);
        const screenshots = await client.screenshots(
          selector,
          deviceScaleFactor,
        );
        return {
          elements,
          images: screenshots.map((x) => x.data),
        };
      });

      // write figures to disk
      const sourceNames: string[] = [];

      for (let i = 0; i < images.length; ++i) {
        const { sourceName, fullName } = context
          .uniqueFigureName(prefix, ".png");
        sourceNames.push(sourceName);
        Deno.writeFileSync(fullName, images[i]);
      }

      return {
        filenames: sourceNames,
        elements,
      };
    },

    cellContent(cell: QuartoMdCell): MappedString {
      if (typeof cell?.options?.file === "string") {
        // FIXME this file location won't be changed under include fixups...
        try {
          return mappedStringFromFile(
            context.resolvePath(cell?.options?.file),
          );
        } catch (e) {
          error(`Couldn't open file ${cell?.options?.file}`);
          throw e;
        }
      } else {
        return cell.source;
      }
    },
    resolvePath(path: string): string {
      const sourceDir = dirname(options.context.target.source);
      const rootDir = options.context.project?.dir || sourceDir;
      if (path.startsWith("/")) {
        // it's a root-relative path
        return resolve(rootDir, `.${path}`);
      } else {
        // it's a relative path
        return resolve(sourceDir, path);
      }
    },
    uniqueFigureName(prefix?: string, extension?: string) {
      prefix = prefix ?? "figure-";
      extension = extension ?? ".png";

      if (!globalFigureCounter[prefix]) {
        globalFigureCounter[prefix] = 1;
      } else {
        globalFigureCounter[prefix]++;
      }

      const pngName = `${prefix}${globalFigureCounter[prefix]}${extension}`;
      const tempName = join(context.figuresDir(), pngName);
      const baseDir = dirname(options.context.target.source);
      const mdName = relative(baseDir, tempName);

      this.addSupporting(relative(baseDir, context.figuresDir()));

      return {
        baseName: basename(mdName),
        sourceName: mdName,
        fullName: tempName,
      };
    },
    figuresDir() {
      const file = normalizePath(options.context.target.source);
      const filesDir = join(dirname(file), inputFilesDir(file));
      const result = join(
        filesDir,
        figuresDir(context.options.format.pandoc.to),
      );
      ensureDirSync(result);
      return result;
    },
    addHtmlDependency(
      dep: FormatDependency,
    ) {
      if (results.extras.html === undefined) {
        results.extras.html = { [kDependencies]: [dep] };
      } else {
        results.extras.html[kDependencies]!.push(dep);
      }
    },
    addSupporting(dir: string) {
      if (results.supporting.indexOf(dir) === -1) {
        results.supporting.push(dir);
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

// return cell language handler only
export function languages(): string[] {
  const cellLanguage = [];
  for (const [k, v] of Object.entries(handlers)) {
    if (v.type === "cell") {
      cellLanguage.push(k);
    }
  }
  return cellLanguage;
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

const processMarkdownIncludes = async (
  newCells: MappedString[],
  options: LanguageCellHandlerOptions,
) => {
  const includeHandler = makeHandlerContext({
    ...options,
  });
  // search for include shortcodes in the cell content
  for (let i = 0; i < newCells.length; ++i) {
    const lines = mappedLines(newCells[i], true);
    let foundShortcodes = false;
    for (let j = 0; j < lines.length; ++j) {
      const shortcode = isBlockShortcode(lines[j].value);
      if (shortcode && shortcode.name === "include") {
        foundShortcodes = true;
        const param = shortcode.params[0];
        if (!param) {
          throw new Error("Include directive needs filename as a parameter");
        }
        lines[j] = await standaloneInclude(includeHandler.context, param);
      }
    }
    if (foundShortcodes) {
      newCells[i] = mappedConcat(lines);
    }
  }
};

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
    newCells.push(
      i === 0 ? cell.sourceVerbatim : mappedConcat(["\n", cell.sourceVerbatim]),
    );
    if (
      cell.cell_type === "raw" ||
      cell.cell_type === "markdown"
    ) {
      continue;
    }
    const language = cell.cell_type.language;
    if (language !== "_directive" && handlers[language] === undefined) {
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
    if (language === "_directive") {
      // if this is a directive, the semantics are that each the _contents_ of the cell
      // are first treated as if they were an entire markdown document that will be fully
      // parsed/handled etc. The _resulting_ markdown is then sent for handling by the
      // directive handler
      for (const cell of cells) {
        const directiveCellType = cell.source.cell_type as DirectiveCell;
        const innerLanguage = directiveCellType.name;
        const innerLanguageHandler = handlers[innerLanguage]!;

        if (
          innerLanguageHandler &&
          (innerLanguageHandler.stage !== "any" &&
            innerLanguageHandler.stage !== options.stage)
        ) { // we're in the wrong stage, so we don't actually do anything
          newCells[cell.index] = mappedConcat([newCells[cell.index], "\n"]);
          continue;
        }
        if (
          innerLanguageHandler === undefined ||
          innerLanguageHandler.type === "cell"
        ) {
          // if no handler is present (or a directive was included for something
          // that responds to cells instead), we're a no-op
          newCells[cell.index] = mappedConcat([newCells[cell.index], "\n"]);
          continue;
        }
        if (innerLanguageHandler.directive === undefined) {
          throw new Error(
            "Bad language handler: directive callback is undefined",
          );
        }

        // call specific handler
        const innerHandler = makeHandlerContext({
          ...options,
          name: innerLanguage,
        });

        newCells[cell.index] = asMappedString(
          await innerLanguageHandler.directive(
            innerHandler.context,
            directiveCellType,
          ),
        );

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
        languageHandler.type !== "directive"
      ) {
        const transformedCells = await languageHandler.document(
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

  // now handle the markdown content. This is necessary specifically for
  // include shortcodes that can still be hiding inside of code blocks
  await processMarkdownIncludes(newCells, options);

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

  async document(
    handlerContext: LanguageCellHandlerContext,
    cells: QuartoMdCell[],
  ): Promise<MappedString[]> {
    this.documentStart(handlerContext);
    const mermaidExecute =
      handlerContext.options.format.mergeAdditionalFormats!(
        {
          execute: this.defaultOptions,
        },
      ).execute;
    const result = await Promise.all(cells.map((cell) => {
      return this.cell(
        handlerContext,
        cell,
        mergeConfigs(
          mermaidExecute as Record<string, unknown>,
          cell.options ?? {},
        ),
      );
    }));
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
  ): Promise<MappedString> {
    return Promise.resolve(cell.sourceVerbatim);
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
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    content: MappedString,
    options: Record<string, unknown>, // these include handler options
    extraCellOptions?: Record<string, unknown>, // these will be passed directly to getDivAttributes
    skipOptions?: Set<string>, // these will _not_ be serialized in the cell even if they're in the options
  ): MappedString {
    // split content into front matter vs input
    const contentLines = mappedLines(cell.sourceWithYaml!, true);
    const frontMatterLines: MappedString[] = [];
    const commentPattern = optionCommentPatternFromLanguage(this.languageName);
    let inputIndex = 0;
    for (const contentLine of contentLines) {
      const commentMatch = contentLine.value.match(commentPattern);
      if (commentMatch) {
        if (contentLine.value.indexOf("echo: fenced") === -1) {
          frontMatterLines.push(contentLine);
        }
        ++inputIndex;
      } else {
        break;
      }
    }
    const inputLines = contentLines.slice(inputIndex);
    const { classes, attrs } = getDivAttributes({
      ...({
        [kFigAlign]: handlerContext.options.format.render[kFigAlign],
      }),
      ...(extraCellOptions || {}),
      ...cell.options,
    }, skipOptions);

    const hasAttribute = (attrKey: string) =>
      attrs.some((attr) => attr === attrKey || attr.startsWith(`${attrKey}=`));

    const hasLayoutAttributes = hasAttribute(kLayoutNrow) ||
      hasAttribute(kLayoutNcol) || hasAttribute(kLayout);
    const isPowerpointOutput = handlerContext.options.format.pandoc.to
      ?.startsWith("pptx");

    const unrolledOutput = isPowerpointOutput && !hasLayoutAttributes;

    const t3 = pandocBlock("```");
    const t4 = pandocBlock("````");

    const cellBlock = unrolledOutput
      ? pandocList({ skipFirstLineBreak: true })
      : pandocBlock(":::")({
        classes: ["cell", ...classes],
        attrs,
      });

    const languageClass: string = this.languageClass === undefined
      ? this.languageName
      : (typeof this.languageClass === "string"
        ? this.languageClass
        : this.languageClass(handlerContext.options));

    const cellInputClasses = [
      languageClass,
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
      cellInputAttrs.push(`code-fold="${options[kCodeFold]}"`);
    }

    switch (options.echo) {
      case true: {
        const cellInput = t3({
          classes: cellInputClasses,
          attrs: cellInputAttrs,
        });
        cellInput.push(pandocRawStr(mappedTrim(mappedConcat(inputLines))));
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
          skipFirstLineBreak: true,
        });
        const fencedInput = mappedConcat([
          ...frontMatterLines,
          ...inputLines,
        ]);
        cellFence.push(pandocRawStr(mappedTrim(fencedInput)));
        cellInput.push(cellFence);
        cellBlock.push(cellInput);
        break;
      }
    }

    const divBlock = pandocBlock(":::");

    // PandocNodes ignore self-pushes (n.push(n))
    // this makes it much easier to write the logic around "unrolled blocks"
    const cellOutputDiv = unrolledOutput ? cellBlock : divBlock({
      // id: cell.options?.label as (string | undefined),
      attrs: cellOutputAttrs,
      classes: cellOutputClasses,
    });

    cellBlock.push(cellOutputDiv);

    const figureLikeOptions: Record<string, unknown> = {};
    if (typeof cell.options?.label === "string") {
      figureLikeOptions.id = cell.options?.label;
    }
    const figureLike = unrolledOutput ? cellBlock : divBlock(figureLikeOptions);
    const cellOutput = unrolledOutput ? cellBlock : divBlock();

    figureLike.push(cellOutput);
    cellOutputDiv.push(figureLike);

    if (options.eval === true) {
      cellOutput.push(pandocRawStr(content));
    }
    if (cell.options?.[kCellFigCap]) {
      // this is a hack to get around that if we have a figure caption but no label,
      // nothing in our pipeline will recognize the caption and emit
      // a figcaption element.
      //
      // necessary for https://github.com/quarto-dev/quarto-cli/issues/4376
      let capOpen = "", capClose = "";
      if (cell.options?.label === undefined) {
        capOpen = "`<figcaption>`{=html} ";
        capClose = "`</figcaption>`{=html} ";
      }

      figureLike.push(
        pandocRawStr(
          `\n\n${capOpen}${cell.options[kCellFigCap] as string}${capClose}`,
        ),
      );
    }
    if (cell.options?.label === undefined) {
      figureLike.unshift(pandocRawStr("`<figure class=''>`{=html}\n"));
      figureLike.push(pandocRawStr("`</figure>`{=html}\n"));
    }

    return cellBlock.mappedString();
  },
};

export function getDivAttributes(
  options: Record<string, unknown>,
  forceSkip?: Set<string>,
): { attrs: string[]; classes: string[] } {
  const attrs: string[] = [];
  if (forceSkip) {
    options = { ...options };
    for (const skip of forceSkip) {
      delete options[skip];
    }
  }

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

  for (const [key, value] of Object.entries(options || {})) {
    if (!keysToNotSerialize.has(key)) {
      const t = typeof value;
      if (t === "undefined") {
        continue;
      }
      if (t === "object") {
        attrs.push(`${key}="${JSON.stringify(value)}"`);
      } else if (t === "string") {
        attrs.push(`${key}=${JSON.stringify(value)}`);
      } else if (t === "number") {
        attrs.push(`${key}="${value}"`);
      } else if (t === "boolean") {
        attrs.push(`${key}=${value}`);
      } else {
        throw new Error(
          `Can't serialize yaml metadata value of type ${t}, key ${key}`,
        );
      }
    }
  }
  if (options?.[kCellLstCap]) {
    attrs.push(`lst-cap="${options?.[kCellLstCap]}"`);
  }
  const classStr = (options?.classes as (string | undefined)) || "";

  const classes = classStr === "" ? [] : classStr.trim().split(" ");
  if (typeof options?.[kFigAlign] === "string") {
    attrs.push(`layout-align="${options?.[kFigAlign]}"`);
  }
  if (typeof options?.panel === "string") {
    classes.push(`panel-${options?.panel}`);
  }
  if (typeof options?.column === "string") {
    classes.push(`column-${options?.column}`);
  }
  if (typeof options?.[kCapLoc] === "string") {
    classes.push(`caption-${options?.[kCapLoc]}`);
  }
  if (typeof options?.[kFigCapLoc] === "string") {
    classes.push(`fig-cap-location-${options?.[kFigCapLoc]}`);
  }
  if (typeof options?.[kTblCapLoc] === "string") {
    classes.push(`tbl-cap-location-${options?.[kTblCapLoc]}`);
  }
  if (typeof options?.[kCellFigColumn] === "string") {
    classes.push(`fig-caption-${options?.[kCellFigColumn]}`);
  }
  if (typeof options?.[kCellTblColumn] === "string") {
    classes.push(`fig-caption-${options?.[kCellTblColumn]}`);
  }
  return { attrs, classes };
}
