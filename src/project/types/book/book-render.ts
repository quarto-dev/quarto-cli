/*
* book-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectMetadata } from "../../project-context.ts";

export const kContents = "contents";

export function bookRenderList(metadata: ProjectMetadata) {
  const contents = metadata[kContents];
  if (contents) {
    return [];
  } else {
    return [];
  }
}
