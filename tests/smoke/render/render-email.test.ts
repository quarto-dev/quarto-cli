/*
* render-email.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { TestContext, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import { validJsonFileExists, fileExists } from "../../verify.ts";
import { testRender } from "./render.ts";
import { dirname } from "path/mod.ts";

const jsonFile = docs("email/.output_metadata.json");
const previewFile = docs("email/email-preview/index.html")

const verifyEmailOutputs: Verify[] = [validJsonFileExists(jsonFile), fileExists(previewFile)];

const cleanupCtx: TestContext = {
  teardown: () => {
    const cleanup = [jsonFile, previewFile, dirname(previewFile)];
    cleanup.forEach((file) => {
      if (existsSync(file)) {
        Deno.removeSync(file);
      }
      })
    return Promise.resolve();
  },
};


testRender(docs("email/email.qmd"), "email", false, verifyEmailOutputs, cleanupCtx);
testRender(docs("email/email-attach.qmd"), "email", false, verifyEmailOutputs, cleanupCtx);