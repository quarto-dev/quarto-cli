/*
* format-pdf-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, extname, join } from "path/mod.ts";

import { kKeepTex } from "../../config/constants.ts";

import { texSafeFilename } from "../../core/tex.ts";

import { RenderedFile } from "../../command/render/render.ts";
import { ProjectContext } from "../../project/project-context.ts";
import { BookExtension } from "../../project/types/book/book-extension.ts";

export const pdfBookExtension: BookExtension = {
  onSingleFileRendered: (
    project: ProjectContext,
    renderedFile: RenderedFile,
  ) => {
    // if we have keep-tex then rename the input tex file to match the final output
    // file (but make sure it has a tex-friendly filename)
    if (renderedFile.format.render[kKeepTex]) {
      const finalOutputFile = renderedFile.file!;
      const texOutputFile =
        texSafeFilename(basename(finalOutputFile, extname(finalOutputFile))) +
        ".tex";
      Deno.renameSync(
        join(project.dir, "index.tex"),
        join(project.dir, texOutputFile),
      );
    }
  },
};
