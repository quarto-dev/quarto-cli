import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";
import { DependencyFile, Format } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { QuartoMdCell } from "../lib/break-quarto-md-types.ts";
import { MappedString } from "../lib/text-types.ts";
import { ConcreteSchema } from "../lib/yaml-schema/types.ts";
import { TempContext } from "../temp-types.ts";
export type PandocIncludeType =
  | typeof kIncludeBeforeBody
  | typeof kIncludeAfterBody
  | typeof kIncludeInHeader;

export interface LanguageCellHandlerOptions {
  name: string;
  version?: string;
  source: string;
  format: Format;
  markdown: MappedString;
  libDir: string;
  temp: TempContext;
  project?: ProjectContext;
}
export interface LanguageCellHandlerContext {
  options: LanguageCellHandlerOptions;
  addResource: (name: string, contents: string) => void;
  addInclude: (content: string, where: PandocIncludeType) => void;
  addDependency: (
    dependencyType: "script" | "stylesheet" | "resource",
    dependency: DependencyFile,
  ) => void;
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
  ) => MappedString;

  comment?: LanguageComment;
  defaultOptions?: Record<string, unknown>;
  schema?: () => Promise<ConcreteSchema>;
  build: (
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    content: MappedString,
  ) => MappedString;

  handlerType: "cell" | "component" | "any";
  languageName: string;
  languageClass?: string;
}
