/*
 * syntax.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";
import {
  ExecuteOutput,
  test,
  TestContext,
  TestDescriptor,
  Verify,
} from "../../test.ts";
import { assert, fail } from "testing/asserts.ts";
import { quarto } from "../../../src/quarto.ts";

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
    Deno.removeSync(imgQmd.output.outputPath);
    Deno.removeSync(imgQmd.output.supportPath, { recursive: true });

    Deno.removeSync(divQmd.output.outputPath);
    Deno.removeSync(divQmd.output.supportPath, { recursive: true });
    return Promise.resolve();
  },
};
const testDesc: TestDescriptor = { // FIXME: why is this test flaky now? Ask @dragonstyle
  name: "test html produced by different figure syntax",
  context,
  execute: async () => {
    await quarto(["render", imgQmd.input]);
    await quarto(["render", divQmd.input]);
  },
  verify: [verify],
  type: "smoke",
};
test(testDesc);
