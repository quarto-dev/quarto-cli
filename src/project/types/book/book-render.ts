/*
* book-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { join } from "path/mod.ts";

import { safeExistsSync } from "../../../core/path.ts";
import { Metadata } from "../../../config/metadata.ts";

import { fileExecutionEngine } from "../../../execute/engine.ts";

import {
  ExecutedFile,
  formatKeys,
  RenderedFile,
  RenderOptions,
} from "../../../command/render/render.ts";

import { normalizeSidebarItem, SidebarItem } from "../../project-config.ts";
import { ProjectContext } from "../../project-context.ts";
export const kContents = "contents";

export function bookPandocRenderer(
  _options: RenderOptions,
  project?: ProjectContext,
) {
  // project always exists
  project = project!;

  // accumulate executed files for all formats
  const files: Record<string, ExecutedFile[]> = {};

  return {
    onRender: (format: string, file: ExecutedFile) => {
      files[format] = files[format] || [];
      files[format].push(file);
      return Promise.resolve();
    },
    onComplete: () => {
      // rendered files to return
      const renderedFiles: RenderedFile[] = [];

      // some formats need to end up returning all of the individual renderedFiles
      // (e.g. html or asciidoc) and some formats will consolidate all of their
      // files into a single one (e.g. pdf or epub)
      for (const format of Object.keys(files)) {
        console.log(format);
      }

      return Promise.resolve(renderedFiles);
    },
    onError: () => {
      // TODO: We can probably clean up files_dirs here
    },
  };
}

export function bookRenderList(projectDir: string, metadata: Metadata) {
  if (metadata[kContents]) {
    const contents = (metadata[kContents] as SidebarItem[])
      .map((item) => normalizeSidebarItem(projectDir, item));

    const inputs: string[] = [];
    const findInputs = (
      collection: Array<unknown> | Record<string, unknown>,
    ) => {
      ld.forEach(
        collection,
        (
          value: unknown,
          index: unknown,
        ) => {
          if (Array.isArray(value)) {
            findInputs(value);
          } else if (typeof (value) === "object") {
            findInputs(value as Record<string, unknown>);
          } else if (
            index === "href" && typeof (value) === "string" &&
            safeExistsSync(join(projectDir, value)) &&
            fileExecutionEngine(join(projectDir, value), true)
          ) {
            inputs.push(value);
          }
        },
      );
    };
    findInputs(contents);

    return inputs;
  } else {
    return [];
  }
}
