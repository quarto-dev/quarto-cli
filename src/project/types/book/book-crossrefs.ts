/*
* book-crossrefs.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import {
  kCrossrefChapters,
  kCrossrefChaptersAlpha,
  kCrossrefLabels,
  kOutputFile,
} from "../../../config/constants.ts";
import { defaultWriterFormat } from "../../../format/formats.ts";
import { ProjectContext, projectOutputDir } from "../../project-context.ts";
import { crossrefIndexForOutputFile } from "../../project-crossrefs.ts";
import { inputTargetIndex } from "../../project-index.ts";
import { ProjectOutputFile } from "../project-types.ts";
import { bookConfigRenderItems } from "./book-config.ts";
import { isMultiFileBookFormat } from "./book-extension.ts";

export async function bookCrossrefsPostRender(
  context: ProjectContext,
  _incremental: boolean,
  outputFiles: ProjectOutputFile[],
) {
  // output dir for the project
  const projOutput = projectOutputDir(context);

  // if we have any output files that require crossref resolution
  const crossrefOutputFiles = outputFiles.filter((file) =>
    isMultiFileBookFormat(file.format)
  );
  if (crossrefOutputFiles.length > 0) {
    const indexes = await bookCrossrefIndexes(context);
    console.log(indexes);

    for (const outputFile of crossrefOutputFiles) {
      const index = bookCrossrefIndexForOutputFile(
        relative(projOutput, outputFile.file),
        indexes,
      );
    }
  }
}

interface BookCrossrefIndex {
  files: { [key: string]: BookCrossrefOptions };
  entries: { [key: string]: BookCrossrefEntry };
}

interface BookCrossrefOptions {
  [kCrossrefLabels]?: boolean;
  [kCrossrefChapters]?: boolean;
  [kCrossrefChaptersAlpha]?: boolean;
}

interface BookCrossrefEntry {
  key: string;
  parent?: string;
  file: string;
  order: {
    number: number;
    chapter?: number;
  };
}

function bookCrossrefIndexForOutputFile(
  outputFile: string,
  indexes: BookCrossrefIndex[],
) {
  return indexes.find((index) =>
    Object.keys(index.files).find((file) => file === outputFile)
  );
}

async function bookCrossrefIndexes(
  context: ProjectContext,
): Promise<BookCrossrefIndex[]> {
  // create a separate index for each format we encounter
  const indexes = {} as Record<string, BookCrossrefIndex>;

  const renderFiles = bookConfigRenderItems(context.config).filter((item) =>
    !!item.file
  );
  for (const renderFile of renderFiles) {
    const file = renderFile.file!;
    const index = await inputTargetIndex(context, file);
    if (index) {
      for (const formatName of Object.keys(index.formats)) {
        if (isMultiFileBookFormat(defaultWriterFormat(formatName))) {
          const format = index.formats[formatName];
          if (format.pandoc[kOutputFile]) {
            const outputFile = join(dirname(file), format.pandoc[kOutputFile]!);
            const indexFile = crossrefIndexForOutputFile(
              context.dir,
              outputFile,
            );

            if (existsSync(indexFile)) {
              const indexJson = JSON.parse(Deno.readTextFileSync(indexFile));

              // ensure we have an index for this format
              indexes[formatName] = indexes[formatName] ||
                { files: {}, entries: {} };
              const index = indexes[formatName];

              // set file options
              index.files[outputFile] = indexJson.options || {};

              // grab entries
              indexJson.entries.forEach((entry: BookCrossrefEntry) => {
                index.entries[entry.key] = {
                  ...entry,
                  file: outputFile,
                };
              });
            }
          }
        }
      }
    }
  }

  return Object.values(indexes);
}
