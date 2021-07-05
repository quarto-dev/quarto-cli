/*
* book-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { RenderedFile } from "../../../command/render/types.ts";
import { Format } from "../../../config/types.ts";
import { PartitionedMarkdown } from "../../../core/pandoc/types.ts";
import { ProjectConfig, ProjectContext } from "../../types.ts";

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
  | "subtitle"
  | "author"
  | "description"
  | "date"
  | "abstract"
  | "cover-image";

export const kBook = "book";
export const kBookCoverImage = "cover-image";

export interface BookExtension {
  // bool extensions are single file by default but can elect to be multi file
  multiFile?: boolean;

  // book extensions can modify the format before render
  onSingleFilePreRender?: (format: Format, config?: ProjectConfig) => Format;

  // book extensions can post-process the final rendered file
  onSingleFilePostRender?: (
    project: ProjectContext,
    file: RenderedFile,
  ) => void;
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

export function isNumberedChapter(partitioned: PartitionedMarkdown) {
  return !partitioned.headingAttr ||
    !partitioned.headingAttr.classes.includes("unnumbered");
}

export function isMultiFileBookFormat(format: Format) {
  const extension = format.extensions?.book as BookExtension;
  if (extension) {
    return extension.multiFile;
  } else {
    return false;
  }
}
