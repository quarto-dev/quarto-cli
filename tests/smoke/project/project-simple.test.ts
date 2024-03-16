/*
* project-render.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "../../../src/deno_ral/path.ts";

import { Metadata } from "../../../src/config/types.ts";

import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";

import {
  fileExists,
  hasSupportingFiles,
  verifyYamlFile,
} from "../../verify.ts";

import {
  cleanWorking,
  kProjectWorkingDir,
  kQuartoProjectFile,
} from "./common.ts";

// Simple project create
testQuartoCmd(
  "create-project",
  [kProjectWorkingDir],
  [
    fileExists(kQuartoProjectFile),
    verifyYamlFile(
      kQuartoProjectFile,
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

// Simple project render
const expectedFiles = ["plain.qmd", "plain2.qmd"];
const verify = expectedFiles.flatMap((filename) => {
  const input = join(docs("project/plain"), filename);
  return [
    fileExists(input),
    hasSupportingFiles(input, "html"),
  ];
});
testQuartoCmd(
  "render",
  ["docs/project/plain", "--to", "html"],
  verify,
  {
    teardown: () => {
      ["plain.html", "plain2.html", "plain_files", "plain2_files"].forEach(
        (file) => {
          const path = join("docs/project/plain", file);
          if (existsSync(path)) {
            Deno.removeSync(path, { recursive: true });
          }
        },
      );
      return Promise.resolve();
    },
  },
);
