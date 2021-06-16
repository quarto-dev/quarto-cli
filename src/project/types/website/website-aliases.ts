/*
* website-aliases.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ensureDirSync } from "fs/mod.ts";
import { warning } from "log/mod.ts";
import { dirname, extname, join, relative } from "path/mod.ts";

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
        // (for paths like /foo/ or /foo)
        alias = alias as string;
        if (alias.endsWith("/")) {
          alias = `${alias}index.html`;
        } else if (extname(alias) === "") {
          alias = `${alias}/index.html`;
        }

        // The file to write
        const aliasTarget = alias.startsWith("/")
          ? join(outputDir, alias.slice(1))
          : join(dirname(outputFile.file), alias);

        // Resolve the href to the file
        const aliasHref = relative(dirname(aliasTarget), outputFile.file);

        try {
          // Make sure the directory exists
          ensureDirSync(dirname(aliasTarget));
        } catch {
          // If there is a file with a conflicting name (this should be rare, warn and skip)
          warning(
            `Directory ${
              dirname(aliasTarget)
            } couldn't be written. Is there a file name that conflicts with a directory in that path?`,
          );
          continue;
        }

        // Write the redirect file
        writeRedirectPage(aliasTarget, aliasHref);
      }
    }
  }
}
