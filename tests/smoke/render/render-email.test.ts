/*
* render-email.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { TestContext, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import { dirname, join } from "path/mod.ts";
import { testProjectRender } from "../project/common.ts";
import { fileExists, validJsonWithFields } from "../../verify.ts";
import { testRender } from "./render.ts";

const jsonFile = docs("email/.output_metadata.json");
const previewFile = docs("email/email-preview/index.html")


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

// Test a basic email render, verifies that the outputs are about what is expected
testRender(docs("email/email.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": "The subject line."})], cleanupCtx);

// Test basic attachment render, which will validate that attachment shows up in JSON
testRender(docs("email/email-attach.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": "The subject line.", "rsc_email_attachments": ["raw_data.csv"]})], cleanupCtx);

// Test an email render that has no subject line, this verifies that `rsc_email_subject` key is present and the value is an empty string
testRender(docs("email/email-no-subject.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": ""})], cleanupCtx);

// Render in a project with an output directory and confirm that everything ends up in the output directory
testProjectRender(docs("email/project/email-attach.qmd"), "email", "_out", (outputDir: string) => {
  const verify: Verify[]= [];
  const json = join(outputDir, ".output_metadata.json");
  const preview = join(outputDir, "email-preview", "index.html");
  const attachment = join(outputDir, "raw_data.csv");

  verify.push(fileExists(preview));
  verify.push(fileExists(attachment));
  verify.push(validJsonWithFields(json, {"rsc_email_subject": "The subject line.", "rsc_email_attachments": ["raw_data.csv"]}));
  return verify;
});
