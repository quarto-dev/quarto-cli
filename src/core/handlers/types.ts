import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";
import { DependencyFile, Format } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { MappedString } from "../lib/mapped-text.ts";
import { TempContext } from "../temp.ts";

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

export const baseHandler = {
  // if document() is overridden, then it's the only
  // method that will be called.
  document(
    handlerContext: LanguageCellHandlerContext,
    cells: string[],
  ): string[] {
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
    cell: string,
  ): string {
    return cell;
  },
};

export type LanguageHandler = typeof baseHandler;
