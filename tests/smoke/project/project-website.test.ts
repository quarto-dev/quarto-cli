/*
 * project-website.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

import { Metadata } from "../../../src/config/types.ts";

import { ExecuteOutput, testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import {
  directoryEmptyButFor,
  fileExists,
  verifyYamlFile,
} from "../../verify.ts";

import {
  cleanWorking,
  kProjectWorkingDir,
  kQuartoProjectFile,
} from "./common.ts";
import { assert } from "testing/asserts";

// A website project
testQuartoCmd(
  "create-project",
  [kProjectWorkingDir, "--type", "website"],
  [
    fileExists(kQuartoProjectFile),
    fileExists(join(kProjectWorkingDir, "index.qmd")),
    verifyYamlFile(
      kQuartoProjectFile,
      (yaml: unknown) => {
        // Make sure there is a project yaml section
        const metadata = yaml as Metadata;
        if (
          metadata["project"] !== undefined && metadata["website"] !== undefined
        ) {
          const type = (metadata["project"] as Metadata)["type"];
          return type === "website";
        } else {
          return false;
        }
      },
    ),
  ],
  {
    setup: cleanWorking,
    teardown: cleanWorking,
  },
);

// Site render

const websiteOutputFiles: string[] = [
  "index.html",
  "about.html",
  "search.json",
  "styles.css",
  "site_libs",
];

const outDir = "_site";
const siteProjDir = docs("project/site");
const siteOutDir = join(siteProjDir, outDir);

const verifySiteFiles = websiteOutputFiles.map((file) => {
  return fileExists(join(siteOutDir, file));
});

const verifyPdfBook: Verify[] = [
  ...verifySiteFiles,
  directoryEmptyButFor(siteOutDir, websiteOutputFiles),
];
testQuartoCmd(
  "render",
  [siteProjDir],
  verifyPdfBook,
  {
    teardown: async () => {
      if (existsSync(siteOutDir)) {
        await Deno.remove(siteOutDir, { recursive: true });
      }
    },
  },
);

const mergeNavbarCrumbsConfigSite = docs(
  "websites/search/merge-navbar-crumbs-configuration",
);
const mergeNavbarCrumbsConfigSiteOutDir = join(mergeNavbarCrumbsConfigSite, outDir);
testQuartoCmd(
  "render",
  [mergeNavbarCrumbsConfigSite],
  [
    {
      name: "verify-no-navbar-crumbs-in-searchjson",
      verify: async (outputs: ExecuteOutput[]) => {
        // Verify that the search.json file does not contain any navbar breadcrumbs
        const searchJson = join(mergeNavbarCrumbsConfigSite, "_site", "search.json");
        const searchJsonExists = existsSync(searchJson);
        if (!searchJsonExists) {
          throw new Error(`File ${searchJson} does not exist`);
        }
        const searchJsonContent = await Deno.readTextFile(searchJson);
        const json = JSON.parse(searchJsonContent);
        for (const entry of json) {
          if (entry.crumbs) {
            assert(entry.crumbs[0] !== "Home");
          }
        }
      },
    },
  ],
  {
    teardown: async () => {
      if (existsSync(mergeNavbarCrumbsConfigSiteOutDir)) {
        await Deno.remove(mergeNavbarCrumbsConfigSiteOutDir, { recursive: true });
      }
    },
  },
);
