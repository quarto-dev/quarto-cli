/*
* book-extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format } from "../../../config/format.ts";

import { RenderedFile } from "../../../command/render/render.ts";
import { ProjectContext } from "../../project-context.ts";

export interface BookExtension {
  // bool extensions are single file by default but can elect to be multi file
  multiFile?: boolean;

  // book extensions can post-process the final rendered file
  onSingleFileRendered?: (project: ProjectContext, file: RenderedFile) => void;
}

export function isMultiFileBookFormat(format: Format) {
  const extension = format.extensions?.book as BookExtension;
  if (extension) {
    return extension.multiFile;
  } else {
    return false;
  }
}

export function onSingleFileBookRendered(
  project: ProjectContext,
  file: RenderedFile,
) {
  const extension = file.format.extensions?.book as BookExtension;
  if (extension && extension.onSingleFileRendered) {
    extension.onSingleFileRendered(project, file);
  }
}
