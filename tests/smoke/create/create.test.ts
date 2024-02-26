/*
* create.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { execProcess } from "../../../src/core/process.ts";
import { join } from "path/mod.ts";
import { CreateResult } from "../../../src/command/create/cmd-types.ts";
import { assert } from "testing/asserts.ts";
import { quartoDevCmd } from "../../utils.ts";

const kCreateTypes: Record<string, string[]> = {
  "project": ["website", "default", "book", "website:blog"],
  "extension": [
    "filter",
    "shortcode",
    "revealjs-plugin",
    "journal",
    "format:html",
    "format:pdf",
    "format:docx",
    "format:revealjs",
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
      await t.step(`> quarto ${type} ${template}`, async () => {
        // test quarto cmd render
        const args = ["create", "--json"];
        const stdIn = JSON.stringify(createDirective);
        const process = await execProcess(quartoDevCmd(), {
          args,
          stdout: "piped",
          stderr: "piped",
        }, stdIn);
        assert(process.success, process.stderr);
        if (process.stdout) {
          result = JSON.parse(process.stdout) as CreateResult;
        }
        assert(process.success, process.stderr);
      });

      // Render the artifact
      await t.step(`> render ${type} ${template}`, async () => {
        const path = result!.path;
        const openfiles = result!.openfiles;
        assert(
          openfiles.length > 0,
          `Artifact ${type} ${template} failed to produce any files to open.`,
        );

        for (const file of openfiles) {
          if (file.endsWith(".qmd")) {
            // provide a step name and function
            const args = ["render", file];
            const process = await execProcess(quartoDevCmd(), {
              args,
              cwd: path,
              stdout: "piped",
              stderr: "piped",
            });
            assert(process.success, process.stderr);
          }
        }
      });

      // Cleanup the artifact dir
      Deno.removeSync(artifactPath, { recursive: true });
    });
  }
}
