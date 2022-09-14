/*
* qualified-path.test.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { unitTest } from "../../test.ts";

import {
  makeAbsolutePath,
  makeCwdRelativePath,
  makeDocumentRelativePath,
  makeProjectRelativePath,
} from "../../../src/core/qualified-path.ts";
import {
  DocumentInfo,
  ProjectInfo,
} from "../../../src/core/qualified-path-types.ts";
import {
  assertEquals,
} from "../../../src/vendor/deno.land/std@0.153.0/testing/asserts.ts";

import { relative as path_relative } from "path/mod.ts";

//deno-lint-ignore require-await
unitTest("qualified-path - basic", async () => {
  const paths: ProjectInfo & DocumentInfo = {
    documentDir: "/tmp/project/dir",
    projectDir: "/tmp/project",
  };

  const expectedDocumentRelative = "file1";
  const expectedProjectRelative = "/dir/file1";
  const expectedAbsolute = "/tmp/project/dir/file1";
  const expectedCwdRelative = path_relative(Deno.cwd(), expectedAbsolute);

  const projectRelative = makeProjectRelativePath("/dir/file1");
  const cwdRelative = makeCwdRelativePath(expectedCwdRelative);
  const documentRelative = makeDocumentRelativePath("file1");
  const absolute = makeAbsolutePath("/tmp/project/dir/file1");

  assertEquals(
    projectRelative.asAbsolute(paths).value,
    expectedAbsolute,
  );
  assertEquals(
    documentRelative.asAbsolute(paths).value,
    expectedAbsolute,
  );
  assertEquals(
    cwdRelative.asAbsolute().value,
    expectedAbsolute,
  );

  assertEquals(
    projectRelative.asCwdRelative(paths).value,
    expectedCwdRelative,
  );
  assertEquals(
    documentRelative.asCwdRelative(paths).value,
    expectedCwdRelative,
  );
  assertEquals(
    absolute.asCwdRelative().value,
    expectedCwdRelative,
  );

  assertEquals(
    documentRelative.asProjectRelative(paths).value,
    expectedProjectRelative,
  );
  assertEquals(
    cwdRelative.asProjectRelative(paths).value,
    expectedProjectRelative,
  );
  assertEquals(
    absolute.asProjectRelative(paths).value,
    expectedProjectRelative,
  );

  assertEquals(
    projectRelative.asDocumentRelative(paths).value,
    expectedDocumentRelative,
  );
  assertEquals(
    cwdRelative.asDocumentRelative(paths).value,
    expectedDocumentRelative,
  );
  assertEquals(
    absolute.asDocumentRelative(paths).value,
    expectedDocumentRelative,
  );
});
