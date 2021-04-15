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

  // determine target formats and keep a list of executes files for each
  const formats = formatKeys(project.metadata || {});
  if (formats.length === 0) {
    formats.push("html");
  }

  // accumulate executed files
  const files: Record<string, ExecutedFile[]> = {};
  formats.forEach((format) => files[format] = []);

  return {
    onRender: (format: string, file: ExecutedFile) => {
      files[format].push(file);
      return Promise.resolve();
    },
    onComplete: () => {
      // determine which formats actually have executed files

      return Promise.resolve({});
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
