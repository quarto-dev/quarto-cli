/*
* website-aliases.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ensureDirSync } from "fs/mod.ts";
import { dirname, join, relative } from "path/mod.ts";

import { ProjectContext, projectOutputDir } from "../../project-context.ts";
import { ProjectOutputFile } from "../project-type.ts";
import { writeRedirectPage } from "./website-navigation.ts";

const kAliases = "aliases";

export function updateAliases(
  outputFiles: ProjectOutputFile[],
  context: ProjectContext,
) {
  const outputDir = projectOutputDir(context);
  for (const outputFile of outputFiles) {
    const aliases = outputFile.format.metadata[kAliases];
    if (aliases && Array.isArray(aliases)) {
      for (let alias of aliases) {
        // Ensure the alias points to a file
        alias = alias as string;
        if (alias.endsWith("/")) {
          alias = `${alias}/index.html`;
        }

        // The file to write
        const aliasTarget = alias.startsWith("/")
          ? join(outputDir, alias.slice(1))
          : join(dirname(outputFile.file), alias);

        // Create a project absolute path
        const aliasHref = "/" + relative(outputDir, outputFile.file);

        // Make sure the directory exists
        ensureDirSync(dirname(aliasTarget));

        // Write the redirect file
        writeRedirectPage(aliasTarget, aliasHref);
        console.log(`wrote alias ${aliasTarget}`);
      }
    }
  }
}
