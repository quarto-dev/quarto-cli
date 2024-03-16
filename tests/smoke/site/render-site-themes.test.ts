/*
* render-site.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { copySync } from "fs/copy.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import { fileExists, noErrorsOrWarnings } from "../../verify.ts";

const kThemes = [
  "",
  "none",
  "pandoc",
  "cerulean",
  "cosmo",
  "cyborg",
  "darkly",
  "flatly",
  "journal",
  "litera",
  "lumen",
  "lux",
  "materia",
  "minty",
  "morph",
  "pulse",
  "quartz",
  "sandstone",
  "simplex",
  "sketchy",
  "slate",
  "solar",
  "spacelab",
  "superhero",
  "united",
  "vapor",
  "yeti",
  "zephyr",
];

const workingDir = Deno.makeTempDirSync();
try {
  kThemes.forEach((theme) => {
    const path = join(workingDir, `site-themes-${theme}`);
    const outputFile = join(path, "_site", "index.html");
    const verify: Verify[] = [noErrorsOrWarnings, fileExists(outputFile)];

    // Run the command
    testQuartoCmd(
      "render",
      [
        join(path, "index.qmd"),
        "--to",
        "html",
      ],
      verify,
      {
        setup: () => {
          // Copy to a temp dir
          copySync(docs("site-themes"), path);

          // modify the quarto.yaml file to have the theme we want
          const qYamlFile = join(path, "_quarto.yml");
          const qYaml = Deno.readTextFileSync(qYamlFile);
          const updatedYaml = qYaml.replace(
            /theme: none/,
            theme !== "" ? `theme: ${theme}` : "",
          );

          Deno.writeTextFileSync(qYamlFile, updatedYaml);
          return Promise.resolve();
        },
        teardown: () => {
          // clean output
          Deno.removeSync(path, { recursive: true });
          return Promise.resolve();
        },
      },
    );
  });
} finally {
  Deno.removeSync(workingDir);
}
