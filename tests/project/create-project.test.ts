/*
* create-project.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { Metadata } from "../../src/config/metadata.ts";

import { testQuartoCmd } from "../test.ts";
import { fileExists, verifyYamlFile } from "../verify.ts";

const workingDir = "simple-test";
const quartoYamlFile = join(workingDir, "_quarto.yml");

async function cleanWorking() {
  if (existsSync(workingDir)) {
    await Deno.remove(workingDir, { recursive: true });
  }
}

// A simple project
testQuartoCmd(
  "create-project",
  [workingDir],
  [
    fileExists(quartoYamlFile),
    verifyYamlFile(
      quartoYamlFile,
      ((yaml: unknown) => {
        // Make sure there is a project yaml section
        const metadata = yaml as Metadata;
        return metadata.project !== undefined;
      }),
    ),
  ],
  {
    setup: cleanWorking,
    teardown: cleanWorking,
  },
);

// A book project
testQuartoCmd(
  "create-project",
  [workingDir, "--type", "book"],
  [
    fileExists(quartoYamlFile),
    fileExists(join(workingDir, "index.qmd")),
    fileExists(join(workingDir, "references.bib")),
    verifyYamlFile(
      quartoYamlFile,
      ((yaml: unknown) => {
        // Make sure there is a project yaml section
        const metadata = yaml as Metadata;
        if (
          metadata["project"] !== undefined && metadata["book"] !== undefined
        ) {
          const type = (metadata["project"] as Metadata)["type"];
          return type === "book";
        } else {
          return false;
        }
      }),
    ),
  ],
  {
    setup: cleanWorking,
    teardown: cleanWorking,
  },
);

// A website project
testQuartoCmd(
  "create-project",
  [workingDir, "--type", "site"],
  [
    fileExists(quartoYamlFile),
    fileExists(join(workingDir, "index.qmd")),
    verifyYamlFile(
      quartoYamlFile,
      ((yaml: unknown) => {
        // Make sure there is a project yaml section
        const metadata = yaml as Metadata;
        if (
          metadata["project"] !== undefined && metadata["site"] !== undefined
        ) {
          const type = (metadata["project"] as Metadata)["type"];
          return type === "site";
        } else {
          return false;
        }
      }),
    ),
  ],
  {
    setup: cleanWorking,
    teardown: cleanWorking,
  },
);
