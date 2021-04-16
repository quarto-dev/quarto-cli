/*
* book-extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  ExecutedFile,
  RenderedFile,
  RenderOptions,
} from "../../../command/render/render.ts";
import { ProjectContext } from "../../project-context.ts";

export interface BookExtension {
  renderPandoc: (
    project: ProjectContext,
    options: RenderOptions,
    files: ExecutedFile[],
  ) => Promise<RenderedFile[]>;
}
