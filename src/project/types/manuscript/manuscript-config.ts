/*
 * manuscript-config.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { isAbsolute, join, relative } from "../../../deno_ral/path.ts";
import { ProjectContext } from "../../types.ts";
import { existsSync } from "fs/mod.ts";
import {
  ManuscriptConfig,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import { readLines } from "io/mod.ts";
import { Format } from "../../../config/types.ts";
import { kNotebookViewStyle } from "../../../config/constants.ts";

export const notebookDescriptor = (
  nbPath: string,
  manuscriptConfig: ResolvedManuscriptConfig,
  project: ProjectContext,
) => {
  const notebooks = manuscriptConfig.notebooks;
  return notebooks.find((notebook) => {
    return notebook.notebook === relative(project.dir, nbPath);
  });
};

// Whether this file is the 'article' in the project
// note that it is possible that articles can be rendered as the main
// manuscript, so you may want to consider using isArticleManuscript
// if you need to target only the manuscript (non-notebook) rendering
// of an article
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

// Whether this is the article in a manscript project and whether this
// format is asking for the manuscript rendering of the article.
//
// Articles may be rendered as a notebook if they contain computations
// and this will filter out renderings as a notebook
export const isArticleManuscript = (
  file: string,
  format: Format,
  project: ProjectContext,
  manuscriptConfig: ResolvedManuscriptConfig,
) => {
  return isArticle(file, project, manuscriptConfig) &&
    format.render[kNotebookViewStyle] !== "notebook";
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
