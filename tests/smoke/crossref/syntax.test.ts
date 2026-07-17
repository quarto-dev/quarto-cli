/*
 * syntax.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureFileRegexMatches, noErrors } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";
import {
  ExecuteOutput,
  test,
  TestContext,
  TestDescriptor,
  Verify,
} from "../../test.ts";
import { assert, fail } from "testing/asserts";
import { runQuarto } from "../../quarto-cmd.ts";
import { safeRemoveSync } from "../../../src/deno_ral/fs.ts";

const syntaxQmd = crossref("syntax.qmd", "html");
testRender(syntaxQmd.input, "html", false, [
  ensureFileRegexMatches(syntaxQmd.output.outputPath, [
    /<div class="figtest-default">[^]*?>Figure&nbsp;1<[^]*?<\/div>/,
    /<div class="figtest-capitalized">[^]*?>Figure&nbsp;1<[^]*?<\/div>/,
    /<div class="figtest-prefix">[^]*?>Figure&nbsp;1<[^]*?<\/div>/,
    /<div class="figtest-noprefix">[^]*?>1<[^]*?<\/div>/,
  ], [
    /\?@fig-/,
  ]),
]);

// Test that two different syntaxes for a basic figure produce
// the same figure output
const imgQmd = crossref("figure-syntax-img.qmd", "html");
const divQmd = crossref("figure-syntax-div.qmd", "html");
const verify: Verify = {
  name: "Compare output",
  verify: (_outputs: ExecuteOutput[]) => {
    const extractBodyRegex = /<body.*?>((.|\n)*)<\/body>/;

    const imgText = Deno.readTextFileSync(imgQmd.output.outputPath);
    const imgBody = extractBodyRegex.exec(imgText);

    const divText = Deno.readTextFileSync(divQmd.output.outputPath);
    const divBody = extractBodyRegex.exec(divText);

    if (imgBody && divBody) {
      assert(
        imgBody[0] === divBody[0],
        "Contents of HTML generated for figures with div vs img syntax do not match.",
      );
    } else {
      fail("Unable to extract html body from output.");
    }

    return Promise.resolve();
  },
};
const context: TestContext = {
  teardown: () => {
    // safeRemoveSync tolerates a missing path: when a render fails, noErrors
    // fails first and these outputs never exist. Raw Deno.removeSync would then
    // throw NotFound from this finally-phase teardown and mask the noErrors
    // report with an unhelpful ENOENT.
    safeRemoveSync(imgQmd.output.outputPath);
    safeRemoveSync(imgQmd.output.supportPath, { recursive: true });

    safeRemoveSync(divQmd.output.outputPath);
    safeRemoveSync(divQmd.output.supportPath, { recursive: true });
    return Promise.resolve();
  },
};
const testDesc: TestDescriptor = { // FIXME: why is this test flaky now? Ask @dragonstyle
  name: "test html produced by different figure syntax",
  context,
  execute: async (logFile?: string) => {
    // render failures land in the log as ERROR records; noErrors below
    // surfaces them (otherwise the comparison verify would just hit an
    // unhelpful ENOENT on the missing output file)
    await runQuarto(["render", imgQmd.input], {
      logFile,
      throwOnFailure: false,
    });
    await runQuarto(["render", divQmd.input], {
      logFile,
      throwOnFailure: false,
    });
  },
  verify: [noErrors, verify],
  type: "smoke",
};
test(testDesc);
