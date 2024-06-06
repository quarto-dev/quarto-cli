/*
* path.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import {
  dirAndStem,
  removeIfEmptyDir,
  removeIfExists,
  resolvePathGlobs,
} from "../../src/core/path.ts";
import { existsSync } from "fs/mod.ts";
import { docs } from "../utils.ts";

const workingDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
const emptyDir = join(workingDir, "empty");

// deno-lint-ignore require-await
unitTest("path - removeIfExists", async () => {
  Deno.mkdirSync(emptyDir);
  removeIfExists(emptyDir);
  assert(!existsSync(emptyDir), "Directory not removed");

  try {
    removeIfExists(emptyDir);
  } catch {
    assert(false, "Removing non-existent directory threw an exception");
  }
});

// deno-lint-ignore require-await
unitTest("path - removeIfEmptyDir", async () => {
  Deno.mkdirSync(emptyDir);
  removeIfEmptyDir(emptyDir);
  assert(!existsSync(emptyDir), "Empty directory was not removed");

  Deno.mkdirSync(emptyDir);
  Deno.writeTextFileSync(join(emptyDir, "foo.txt"), "Hello World");

  removeIfEmptyDir(emptyDir);
  assert(existsSync(emptyDir), "Non-empty directory was removed");

  Deno.removeSync(emptyDir, { recursive: true });
});

interface DirStem {
  path: string;
  dir: string;
  stem: string;
}
// deno-lint-ignore require-await
unitTest("path - dirAndStem", async () => {
  const dirStemTests: DirStem[] = [
    {
      path: "foo/bar.txt",
      dir: "foo",
      stem: "bar",
    },
    {
      path: "foo/bar",
      dir: "foo",
      stem: "bar",
    },
    {
      path: "foo/bar.txt.bar",
      dir: "foo",
      stem: "bar.txt",
    },
    {
      path: "foo/bar/test.txt",
      dir: "foo/bar",
      stem: "test",
    },
    {
      path: "/foo/bar/test.txt",
      dir: "/foo/bar",
      stem: "test",
    },
  ];
  dirStemTests.forEach((dirStem) => {
    const [dir, stem] = dirAndStem(dirStem.path);
    assert(dir === dirStem.dir, `Invalid directory ${dir} from dirAndStem`);
    assert(stem === dirStem.stem, `Invalid stem ${stem} from dirAndStem`);
  });
});

interface GlobTest {
  name: string;
  globs: string[];
  exclude: string[];
  incLen: number;
  excLen: number;
}
const globPath = docs("globs");

// deno-lint-ignore require-await
unitTest("path - resolvePathGlobs", async () => {
  const globTests: GlobTest[] = [{
    name: "simple recursive qmd",
    globs: ["*.qmd"],
    exclude: [],
    incLen: 6,
    excLen: 0,
  }, {
    name: "filter out specific ipynb",
    globs: ["*.ipynb"],
    exclude: ["sub1/*.ipynb"],
    incLen: 4,
    excLen: 0,
  }, {
    name: "exclude glob",
    globs: ["*.ipynb", "!sub1/*.ipynb"],
    exclude: [],
    incLen: 5,
    excLen: 1,
  }, {
    name: "deep path",
    globs: ["sub3/sub3-2/sub3-2-1/sub3-2-1-1/*.*"],
    exclude: [],
    incLen: 5,
    excLen: 0,
  }, {
    name: "filter included file",
    globs: ["sub3/a.qmd"],
    exclude: ["sub3/a.qmd"],
    incLen: 0,
    excLen: 0,
  }, {
    name: "exclude included file",
    globs: ["sub3/a.qmd", "!sub3/a.qmd"],
    exclude: [],
    incLen: 1,
    excLen: 1,
  }];
  globTests.forEach((globTest) => {
    const resolved = resolvePathGlobs(
      globPath,
      globTest.globs,
      globTest.exclude,
    );
    assert(
      resolved.include.length === globTest.incLen,
      `Invalid include result: ${globTest.name}`,
    );
    assert(
      resolved.exclude.length === globTest.excLen,
      `Invalid exclude result: ${globTest.name}`,
    );
  });
});
