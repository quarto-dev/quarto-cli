/*
* render-email.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { TestContext, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import { dirname, join } from "../../../src/deno_ral/path.ts";
import { testProjectRender } from "../project/common.ts";
import { fileExists, validJsonWithFields } from "../../verify.ts";
import { testRender } from "./render.ts";
import { assert } from "testing/asserts";

const jsonFile = docs("email/.output_metadata.json");
const previewFile = docs("email/email-preview/index.html")
const previewFileV2 = docs("email/email-preview/email_id-1.html")

// Custom verification for v2 email format that checks specific fields in emails array
const validJsonWithEmailStructure = (file: string, expectedFields: Record<string, unknown>): Verify => {
  return {
    name: `Valid Json ${file} with email structure`,
    verify: (_output) => {
      const jsonStr = Deno.readTextFileSync(file);
      const json = JSON.parse(jsonStr);
      
      // Check rsc_email_version
      assert(json.rsc_email_version === 2, "rsc_email_version should be 2");
      assert(Array.isArray(json.emails), "emails should be an array");
      assert(json.emails.length > 0, "emails array should not be empty");
      
      // Check specific fields in first email, ignoring body_html and body_text
      const email = json.emails[0];
      for (const [key, expectedValue] of Object.entries(expectedFields)) {
        const actualValue = email[key];
        assert(
          JSON.stringify(actualValue) === JSON.stringify(expectedValue),
          `Email field ${key} mismatch. Expected: ${JSON.stringify(expectedValue)}, Got: ${JSON.stringify(actualValue)}`
        );
      }
      
      return Promise.resolve();
    }
  };
};


const cleanupCtx: TestContext = {
  teardown: () => {
    if (existsSync(jsonFile)) {
      Deno.removeSync(jsonFile);
    }
    // Clean up the preview file that exists (v1 format: index.html)
    if (existsSync(previewFile)) {
      Deno.removeSync(previewFile);
    }
    // Clean up any v2 preview files matching email_id-*.html pattern
    const previewDir = dirname(previewFile);
    if (existsSync(previewDir)) {
      for (const entry of Deno.readDirSync(previewDir)) {
        if (entry.isFile && /^email_id-\d+\.html$/.test(entry.name)) {
          Deno.removeSync(join(previewDir, entry.name));
        }
      }
      // Remove the preview directory itself
      Deno.removeSync(previewDir);
    }
    return Promise.resolve();
  },
};

// Test a basic email render, verifies that the outputs are about what is expected
testRender(docs("email/email.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": "The subject line."})], cleanupCtx);

// Test basic attachment render, which will validate that attachment shows up in JSON
testRender(docs("email/email-attach.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": "The subject line.", "rsc_email_attachments": ["raw_data.csv"]})], cleanupCtx);

// Test an email render that has no subject line, this verifies that `rsc_email_subject` key is present and the value is an empty string
testRender(docs("email/email-no-subject.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": ""})], cleanupCtx);

// Test an email render that has a subject line after the email div, this verifies that `rsc_email_subject` key is present
testRender(docs("email/email-subject-document-level.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": "The subject line, after the email div.", "rsc_email_body_text": "An optional text-only version of the email message.\n"})], cleanupCtx);

// V2 format tests - Connect 2026.03+ with multi-email support
// Verify the v2 format includes rsc_email_version and emails array with expected structure
testRender(docs("email/email.qmd"), "email", false, [fileExists(previewFileV2), validJsonWithEmailStructure(jsonFile, {
  "email_id": 1,
  "subject": "The subject line.",
  "attachments": [],
  "suppress_scheduled": false,
  "send_report_as_attachment": false
})], {
  ...cleanupCtx,
  env: {
    "SPARK_CONNECT_USER_AGENT": "posit-connect/2026.03.0"
  }
});

// Test attachment with v2 format
testRender(docs("email/email-attach.qmd"), "email", false, [fileExists(previewFileV2), validJsonWithEmailStructure(jsonFile, {
  "email_id": 1,
  "subject": "The subject line.",
  "attachments": ["raw_data.csv"],
  "suppress_scheduled": false,
  "send_report_as_attachment": false
})], {
  ...cleanupCtx,
  env: {
    "SPARK_CONNECT_USER_AGENT": "posit-connect/2026.03.0"
  }
});

// Test no subject with v2 format
testRender(docs("email/email-no-subject.qmd"), "email", false, [fileExists(previewFileV2), validJsonWithEmailStructure(jsonFile, {
  "email_id": 1,
  "subject": "",
  "attachments": [],
  "suppress_scheduled": false,
  "send_report_as_attachment": false
})], {
  ...cleanupCtx,
  env: {
    "SPARK_CONNECT_USER_AGENT": "posit-connect/2026.03.0"
  }
});

// Test an email render that has a subject line after the email div - this should output v1 format
// since the metadata divs are at the document level (outside email), indicating v1 style
testRender(docs("email/email-subject-document-level.qmd"), "email", false, [fileExists(previewFile), validJsonWithFields(jsonFile, {"rsc_email_subject": "The subject line, after the email div.", "rsc_email_body_text": "An optional text-only version of the email message.\n"})], {
  ...cleanupCtx,
  env: {
    "SPARK_CONNECT_USER_AGENT": "posit-connect/2026.03.0"
  }
});


// Render in a project with an output directory set in _quarto.yml and confirm that everything ends up in the output directory
testProjectRender(docs("email/project/email-attach.qmd"), "email", (outputDir: string) => {
  const verify: Verify[]= [];
  const json = join(outputDir, ".output_metadata.json");
  const preview = join(outputDir, "email-preview", "index.html");
  const attachment = join(outputDir, "raw_data.csv");

  verify.push(fileExists(preview));
  verify.push(fileExists(attachment));
  verify.push(validJsonWithFields(json, {"rsc_email_subject": "The subject line.", "rsc_email_attachments": ["raw_data.csv"]}));
  return verify;
});
