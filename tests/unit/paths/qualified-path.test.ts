/*
* qualified-path.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { unitTest } from "../../test.ts";

import {
  makePath,
  PathInfo,
  QualifiedPath,
} from "../../../src/core/qualified-path.ts";
import { assertEquals, assertRejects } from "testing/asserts";
import { isWindows } from "../../../src/deno_ral/platform.ts";

//deno-lint-ignore require-await
unitTest("qualified-path - basic", async () => {
  const paths: PathInfo = {
    currentFileDir: "/tmp/project/dir",
    projectRoot: "/tmp/project",
  };

  const projectRelative = makePath("/dir/file1", paths);
  const relative = makePath("file1", paths);
  const absolute = makePath("/tmp/project/dir/file1", paths, true);

  const expectedRelative = "file1";
  const expectedProjectRelative = "/dir/file1";
  const expectedAbsolute = "/tmp/project/dir/file1";

  for (let path of [projectRelative, relative, absolute]) {
    for (let i = 0; i < 30; ++i) {
      const choices = [
        (path: QualifiedPath) => path.asAbsolute(paths),
        (path: QualifiedPath) => path.asRelative(paths),
        (path: QualifiedPath) => path.asProjectRelative(paths),
      ];
      path = choices[~~(Math.random() * choices.length)](path);
      assertEquals(path.asAbsolute(paths).value, expectedAbsolute);
      assertEquals(path.asRelative(paths).value, expectedRelative);
      assertEquals(
        path.asProjectRelative(paths).value,
        expectedProjectRelative,
      );
    }
  }
}, {
  ignore: isWindows,
});

unitTest("qualified-path - validation", async () => {
  const paths: PathInfo = {
    currentFileDir: "/tmp/project/dir",
    projectRoot: "/tmp/project",
  };

  makePath("../file1", paths);

  //deno-lint-ignore require-await
  await assertRejects(async () => {
    // this should raise because it resolves outside of projectRoot.
    return makePath("../../file1", paths);
  });
}, {
  ignore: isWindows,
});
