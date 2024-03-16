/*
 * book-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { PandocOptions, RenderedFile } from "../../../command/render/types.ts";
import { kQuartoVarsKey, kTitle } from "../../../config/constants.ts";
import { Format } from "../../../config/types.ts";
import { parsePandocTitle } from "../../../core/pandoc/pandoc-partition.ts";
import { PartitionedMarkdown } from "../../../core/pandoc/types.ts";
import { ProjectConfig, ProjectContext } from "../../types.ts";
import { ProjectOutputFile } from "../types.ts";
import { kBookOutputFile } from "./book-constants.ts";
import { basename } from "../../../deno_ral/path.ts";
import { texSafeFilename } from "../../../core/tex.ts";

export type BookConfigKey =
  | "output-file"
  | "chapters"
  | "references"
  | "appendices"
  | "render"
  | "repo-actions"
  | "sharing"
  | "downloads"
  | "tools"
  | "title"
  | "doi"
  | "subtitle"
  | "author"
  | "description"
  | "date"
  | "date-format"
  | "abstract"
  | "cover-image"
  | "cover-image-alt";

export const kBook = "book";
export const kBookCoverImage = "cover-image";
export const kBookCoverImageAlt = "cover-image-alt";

export interface BookExtension {
  // bool extensions are single file by default but can elect to be multi file
  multiFile?: boolean;
  selfContainedOutput?: boolean;

  filterFormat?: (
    source: string,
    format: Format,
    project?: ProjectContext,
  ) => Format;

  filterParams?: (options: PandocOptions) => Record<string, unknown>;

  formatOutputDirectory?: () => string;

  // book extensions can modify the format before render
  onSingleFilePreRender?: (format: Format, config?: ProjectConfig) => Format;

  // book extensions can post-process the final rendered file
  onSingleFilePostRender?: (
    project: ProjectContext,
    file: RenderedFile,
  ) => void;

  onMultiFilePrePrender?: (
    isIndex: boolean,
    format: Format,
    markdown: string,
    project: ProjectContext,
  ) => Promise<{ format?: Format; markdown?: string }>;

  bookPostRender?: (
    format: Format,
    context: ProjectContext,
    incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => Promise<void>;
}

export function bookConfig(
  name: BookConfigKey,
  project?: ProjectConfig,
) {
  const book = project?.[kBook] as
    | Record<string, unknown>
    | undefined;
  if (book) {
    return book[name] as
      | Array<unknown>
      | Record<string, unknown>
      | string
      | undefined;
  } else {
    return undefined;
  }
}

export function setBookConfig(
  name: string,
  value: string,
  project: ProjectConfig,
) {
  const book = project?.[kBook] as
    | Record<string, unknown>
    | undefined;
  if (book) {
    book[name] = value;
  }
}

export function isBookIndexPage(target?: string): boolean {
  return target !== undefined && target.startsWith("index.");
}

export function isNumberedChapter(partitioned: PartitionedMarkdown) {
  if (partitioned?.yaml) {
    const yaml = partitioned?.yaml;
    if (typeof yaml[kTitle] === "string") {
      const parsedTitle = parsePandocTitle(yaml[kTitle] as string);
      return !parsedTitle.attr?.classes.includes("unnumbered");
    }
  }
  return !partitioned.headingAttr ||
    !partitioned.headingAttr.classes.includes("unnumbered");
}

export function isMultiFileBookFormat(format: Format) {
  const extension = format.extensions?.book as BookExtension;
  if (extension) {
    return !!extension.multiFile;
  } else {
    return false;
  }
}

const variableRegex = /{{<\s*var\s+(.*?)\s*>}}/gm;
function resolveVariables(value: string, config: ProjectConfig) {
  variableRegex.lastIndex = 0;
  return value.replaceAll(variableRegex, (_: string, varName: string) => {
    const vars = config[kQuartoVarsKey] as Record<string, unknown>;
    if (vars && vars[varName] !== undefined) {
      return String(vars[varName]);
    } else {
      return `?var:${varName}`;
    }
  });
}

export function bookOutputStem(projectDir: string, config?: ProjectConfig) {
  const outputFile = (bookConfig(kBookOutputFile, config) ||
    bookConfig(kTitle, config) || basename(projectDir)) as string;

  // Resolve any variables that appear in the title (since the title
  // may be used as things like file name in the case of a single file output)
  return texSafeFilename(
    config !== undefined ? resolveVariables(outputFile, config) : outputFile,
  );
}
