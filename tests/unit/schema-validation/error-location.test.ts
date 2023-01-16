/*
* error-location.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { unitTest } from "../../test.ts";

//import { schemaTestFile } from "./utils.ts";
//import { cleanoutput } from "../../smoke/render/render.ts";
//import { validateDocumentFromSource } from "../../../src/core/schema/validate-document.ts";

unitTest("schema-validation-error-location", async () => {
  /*
FIXME: we're temporarily disabling this test since it relies on format
checks failing, and our format schema is disabled on `main` to avoid
user breakage at the moment.

  const {
    input
  } = schemaTestFile("good-validation-fail.qmd", "html");

  const src = Deno.readTextFileSync(input);
  const ignore = (_foo: string) => {};
  const errors = await validateDocumentFromSource(src, ignore, ignore);

  // check that it found all bad instances
  const badInstancesGroundTruth = ["/format/html/dpi", "/echo"];
  assert(errors.length === 2);
  const badInstancesSeen = errors.map(error => error.instancePath);
  assert(badInstancesSeen.every(seen => badInstancesGroundTruth.indexOf(seen) !== -1));

  // check that the instances are reported in the right location
  const error1 = errors.filter(error => error.instancePath === "/format/html/dpi")[0];
  const error2 = errors.filter(error => error.instancePath === "/echo")[0];

  // lines and columns are zero-based
  assert(error1.start!.line === 4);
  assert(error1.start!.column === 9);
  assert(error1.end!.line === 4);
  assert(error1.end!.column === 15);

  assert(error2.start!.line === 8);
  assert(error2.start!.column === 9);
  assert(error2.end!.line === 8);
  assert(error2.end!.column === 15);

  cleanoutput("good-validation-fail.qmd", "html");
  */
});
