import { RenderContext, RenderFlags } from "../../command/render/types.ts";
import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";
import { Format, FormatDependency, FormatExtras } from "../../config/types.ts";
import { PandocIncludes } from "../../execute/types.ts";
import { FileInclusion } from "../../project/types.ts";
import { DirectiveCell, QuartoMdCell } from "../lib/break-quarto-md-types.ts";
import { EitherString, MappedString } from "../lib/text-types.ts";
import { ConcreteSchema } from "../lib/yaml-schema/types.ts";
import { TempContext } from "../temp-types.ts";
export type PandocIncludeType =
  | typeof kIncludeBeforeBody
  | typeof kIncludeAfterBody
  | typeof kIncludeInHeader;

export interface LanguageCellHandlerOptions {
  name: string; // language name
  temp: TempContext;
  stage: "pre-engine" | "post-engine";

  // document format. Note that this is different from context.format
  // when stage = "post-engine", since pre-engine handlers
  // can cause the recipe format to change.
  format: Format;

  // document markdown. Note that this is different from
  // context.target.markdown when stage == "post-engine", since engines and pre-engine
  // handlers generally change the markdown
  markdown: MappedString;

  context: RenderContext;

  flags: RenderFlags;

  // per-document state, so that different handlers can share state as needed.
  state?: Record<string, Record<string, unknown>>;
}

export interface LanguageCellHandlerContext {
  options: LanguageCellHandlerOptions;

  /**
   * Returns the state object for that language
   */
  getState(): Record<string, unknown>;

  /**
   * Returns the contents of a cell, using the `file` option when possible to
   * resolve the content
   *
   * @param cell the md cell to extract the content from
   */
  cellContent(cell: QuartoMdCell): MappedString;

  /**
   * Resolves a path name. This handles root-relative paths vs relative paths as well as
   * project contexts vs single-file contexts.
   *
   * @param path input path
   * @return an absolute path in the file system
   */
  resolvePath(path: string): string;

  /**
   * @return
   *   - sourceName: string. path relative to the source, to be included in the output
   *   - baseName: basename(sourceName), for convenience
   *   - fullName: string. full path, to be used to create the file
   */
  uniqueFigureName(prefix?: string, extension?: string): {
    baseName: string;
    sourceName: string;
    fullName: string;
  };

  /**
   * @return the directory to be used for placing figures
   */
  figuresDir(): string;

  /**
   * Generate PNG images from HTML in a temporary directory for use as generated figures.
   * Returns both images and corresponding elements.
   *
   * Uses puppeteer.
   *
   * @param opts.prefix prefix for filenames
   * @param opts.html html content
   * @param opts.deviceScaleFactor scale factor for generated images
   * @param opts.selector CSS selector to extract images
   * @param opts.count number of images to generate. Must match the size of the selector result.
   * @param opts.resources optional [filename, content] list of resources to be created in the temporary directory
   */
  createPngsFromHtml(opts: {
    prefix: string;
    html: string;
    deviceScaleFactor: number;
    selector: string;
    count: number;
    resources?: [string, string][];
  }): Promise<{
    filenames: string[];
    elements: string[];
  }>;

  /**
   * Extract HTML elements from an HTML page. Uses puppeteer.
   *
   * @param opts.html html content
   * @param opts.selector CSS selector to extract elements
   * @param opts.resources optional [filename, content] list of resources to be created in the temporary directory
   */
  extractHtml(opts: {
    html: string;
    selector: string;
    resources?: [string, string][];
  }): Promise<string[]>;

  addResource: (fileName: string) => void;
  addInclude: (content: string, where: PandocIncludeType) => void;
  addHtmlDependency: (
    dep: FormatDependency,
  ) => void;
  addSupporting: (
    dir: string,
  ) => void;
}
export interface HandlerContextResults {
  includes: PandocIncludes;
  resourceFiles: string[];
  extras: FormatExtras;
  supporting: string[]; // additional supporting directories that need to be potentially cleaned-up
}

export type LanguageComment = string | [string, string];
export interface LanguageHandler {
  document: (
    handlerContext: LanguageCellHandlerContext,
    cells: QuartoMdCell[],
  ) => Promise<MappedString[]>;
  documentStart: (handlerContext: LanguageCellHandlerContext) => void;
  documentEnd: (handlerContext: LanguageCellHandlerContext) => void;
  cell: (
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) => Promise<MappedString>;

  directive?: (
    handlerContext: LanguageCellHandlerContext,
    directiveCell: DirectiveCell,
  ) => Promise<EitherString>;

  comment?: LanguageComment;
  defaultOptions?: Record<string, unknown>;
  schema?: () => Promise<ConcreteSchema>;
  build: (
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    content: MappedString,
    options: Record<string, unknown>,
    extraCellOptions?: Record<string, unknown>,
    forceSkip?: Set<string>,
  ) => MappedString;

  type: "cell" | "directive" | "any";
  stage: "pre-engine" | "post-engine" | "any";

  languageName: string;
  languageClass?: string | ((options: LanguageCellHandlerOptions) => string);
}

/**
 * Type for the state object tracked by the include TS handler
 */
export type IncludeState = {
  includes: FileInclusion[];
};
