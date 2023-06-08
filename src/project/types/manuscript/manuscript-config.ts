/*
 * manuscript-config.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/mod.ts";
import { ProjectContext } from "../../types.ts";
import { existsSync } from "fs/mod.ts";
import { isAbsolute } from "path/mod.ts";
import {
  ManuscriptConfig,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import { readLines } from "io/mod.ts";

export const isArticle = (
  file: string,
  project: ProjectContext,
  manuscriptConfig: ResolvedManuscriptConfig,
) => {
  const articlePath = isAbsolute(file)
    ? join(project.dir, manuscriptConfig.article)
    : manuscriptConfig.article;
  return file === articlePath;
};

export const computeProjectArticleFile = (
  projectDir: string,
  config: ManuscriptConfig,
) => {
  let defaultRenderFile: string | undefined = undefined;
  // Build the render list
  if (config.article) {
    // If there is an explicitly specified article file
    defaultRenderFile = config.article;
  } else {
    // Locate a default target
    const defaultArticleFiles = ["index.qmd", "index.ipynb"];
    const defaultArticleFile = defaultArticleFiles.find((file) => {
      return existsSync(join(projectDir, file));
    });
    if (defaultArticleFile !== undefined) {
      defaultRenderFile = defaultArticleFile;
    } else {
      throw new Error(
        "Unable to determine the root input document for this manuscript. Please specify an `article` in your `_quarto.yml` file.",
      );
    }
  }
  return defaultRenderFile;
};

const codeHintRegexes = [/`+{[^\.]+.*}/, /.*"cell_type"\s*:\s*"code".*/];
export const hasComputations = async (file: string) => {
  const reader = await Deno.open(file);
  try {
    for await (const line of readLines(reader)) {
      if (line) {
        if (
          codeHintRegexes.find((regex) => {
            return regex.exec(line);
          })
        ) {
          return true;
        }
      }
    }
    return false;
  } finally {
    reader.close();
  }
};
