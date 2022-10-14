/*
* create.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { execProcess } from "../../../src/core/process.ts";

import { join } from "path/mod.ts";
import { assert } from "../../../src/vendor/deno.land/std@0.153.0/_util/assert.ts";
import { CreateResult } from "../../../src/command/create/cmd.ts";
import { ensureDirSync } from "../../../src/vendor/deno.land/std@0.153.0/fs/ensure_dir.ts";

const kCreateTypes: Record<string, string[]> = {
  "project": ["website", "default", "book", "website:blog"],
  "extension": [
    "filter",
    "shortcode",
    "revealjs-plugin",
    "journal",
    "format-html",
  ],
};

const tempDir = Deno.makeTempDirSync();
for (const type of Object.keys(kCreateTypes)) {
  for (const template of kCreateTypes[type]) {
    Deno.test(`quarto create ${type} ${template}`, async (t) => {
      // Configure the item to test
      const artifactName = template.replaceAll(/:/gm, "");
      const artifactPath = join(tempDir, artifactName);
      const createDirective = {
        type,
        directive: {
          directory: artifactPath,
          template,
          name: artifactName,
        },
      };

      // Create the artifact
      let result: CreateResult | undefined = undefined;
      await t.step(`> create ${type} ${template}`, async () => {
        // test quarto cmd render
        const cmd = ["quarto", "create", "--json"];
        const stdIn = JSON.stringify(createDirective);
        const process = await execProcess({
          cmd,
          stdout: "piped",
          stderr: "piped",
        }, stdIn);
        assert(process.success, process.stderr);
        if (process.stdout) {
          result = JSON.parse(process.stdout) as CreateResult;
        }
        assert(process.success);
      });

      // Render the artifact
      await t.step(`> render ${type} ${template}`, async () => {
        const path = result!.path;
        const openfiles = result!.openfiles;
        for (const file of openfiles) {
          if (file.endsWith(".qmd")) {
            // provide a step name and function
            const cmd = ["quarto", "render", join(path, file)];
            const process = await execProcess({
              cmd,
              stdout: "piped",
              stderr: "piped",
            });
            assert(process.success);
          }
        }
      });

      // Cleanup the artifact dir
      Deno.removeSync(artifactPath, { recursive: true });
    });
  }
}
