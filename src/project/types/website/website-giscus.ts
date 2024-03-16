/*
* website-giscus.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureDirSync } from "fs/mod.ts";
import { join } from "../../../deno_ral/path.ts";
import { Format } from "../../../config/types.ts";
import {
  getDiscussionCategoryId,
  getGithubDiscussionsMetadata,
  GithubDiscussionMetadata,
} from "../../../core/giscus.ts";
import { removeIfExists } from "../../../core/path.ts";
import {
  kComments,
  kGiscus,
  kGiscusCategoryId,
  kGiscusRepoId,
} from "../../../format/html/format-html-shared.ts";
import { projectScratchPath } from "../../project-scratch.ts";
import { ProjectContext } from "../../types.ts";

const kGiscusDir = "giscus";

// Inspects and resolves the github repo id and category id
// for giscus commenting, if needed
export async function resolveFormatForGiscus(
  project: ProjectContext,
  format: Format,
) {
  const comments = format.metadata[kComments] as Record<string, unknown>;
  if (comments) {
    const giscusOptions = comments[kGiscus] as Record<string, unknown>;
    if (giscusOptions) {
      // Giscus is configured, so we need to check whether the
      // the repo-id and category-id are set. If they are not,
      // we need to fetch them and populate them into the format
      if (
        giscusOptions[kGiscusRepoId] === undefined ||
        giscusOptions[kGiscusCategoryId] === undefined
      ) {
        const repo = giscusOptions.repo as string;
        const fileName = `${repo}.json`;

        let giscusMeta: GithubDiscussionMetadata;
        // The scratch directory used to cache metadata
        const giscusPath = projectScratchPath(project.dir, kGiscusDir);
        ensureDirSync(giscusPath);

        // The path to the metadata file for this repo
        const path = join(
          giscusPath,
          fileName.replace("/", "."),
        );

        try {
          // Try to read the cached data and use that
          const giscusJson = Deno.readTextFileSync(path);
          giscusMeta = JSON.parse(giscusJson);
        } catch {
          // Couldn't read the cached metadata, fetch it
          removeIfExists(path);
          giscusMeta = await getGithubDiscussionsMetadata(repo);
          const jsonStr = JSON.stringify(giscusMeta, undefined, 2);
          Deno.writeTextFileSync(path, jsonStr);
        }

        // Populate the ids if need be
        if (giscusOptions[kGiscusRepoId] === undefined) {
          giscusOptions[kGiscusRepoId] = giscusMeta.repositoryId;
        }
        if (giscusOptions[kGiscusCategoryId] === undefined) {
          giscusOptions[kGiscusCategoryId] = getDiscussionCategoryId(
            (giscusOptions[kGiscusCategoryId] || "") as string,
            giscusMeta,
          );
        }
      }
    }
  }
}
