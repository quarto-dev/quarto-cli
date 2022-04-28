import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";
import { DependencyFile, Format, FormatExtras } from "../../config/types.ts";
import { PandocIncludes } from "../../execute/types.ts";
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
  source: string;
  format: Format;
  markdown: MappedString;
  temp: TempContext;
  stage: "pre-engine" | "post-engine";
}
export interface LanguageCellHandlerContext {
  options: LanguageCellHandlerOptions;
  addResource: (name: string, contents: string) => void;
  addInclude: (content: string, where: PandocIncludeType) => void;
  addHtmlDependency: (
    dependencyType: "script" | "stylesheet" | "resource",
    dependency: DependencyFile,
  ) => void;
}
export interface HandlerContextResults {
  includes: PandocIncludes;
  resourceFiles: string[];
  extras: FormatExtras;
}

export type LanguageComment = string | [string, string];
export interface LanguageHandler {
  document: (
    handlerContext: LanguageCellHandlerContext,
    cells: QuartoMdCell[],
  ) => MappedString[];
  documentStart: (handlerContext: LanguageCellHandlerContext) => void;
  documentEnd: (handlerContext: LanguageCellHandlerContext) => void;
  cell: (
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) => MappedString;

  directive?: (
    handlerContext: LanguageCellHandlerContext,
    directiveCell: DirectiveCell,
  ) => EitherString;

  comment?: LanguageComment;
  defaultOptions?: Record<string, unknown>;
  schema?: () => Promise<ConcreteSchema>;
  build: (
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    content: MappedString,
    options: Record<string, unknown>,
  ) => MappedString;

  type: "cell" | "directive" | "any";
  stage: "pre-engine" | "post-engine" | "any";

  languageName: string;
  languageClass?: string;
}
