/*
 * filter-bundled-engines.test.ts
 *
 * Tests that bundled subtree engines are filtered out of metadata
 * regardless of the share path layout (source tree vs installed).
 * Related to issue #14529.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  builtinSubtreeExtensions,
  filterBundledSubtreeEngines,
  isBundledSubtreeEnginePath,
} from "../../../src/extension/extension.ts";
import { join } from "../../../src/deno_ral/path.ts";

unitTest(
  "isBundledSubtreeEnginePath - source-tree share path",
  // deno-lint-ignore require-await
  async () => {
    const subtreePath = "/repo/src/resources/extension-subtrees";
    const enginePath =
      "/repo/src/resources/extension-subtrees/julia-engine/_extensions/julia-engine/julia-engine.js";
    assert(isBundledSubtreeEnginePath(enginePath, subtreePath));
  },
);

unitTest(
  "isBundledSubtreeEnginePath - installed POSIX share path (#14529)",
  // deno-lint-ignore require-await
  async () => {
    const subtreePath = "/usr/local/share/quarto/extension-subtrees";
    const enginePath =
      "/usr/local/share/quarto/extension-subtrees/julia-engine/_extensions/julia-engine/julia-engine.js";
    assert(isBundledSubtreeEnginePath(enginePath, subtreePath));
  },
);

unitTest(
  "isBundledSubtreeEnginePath - installed Windows share path (#14529)",
  // deno-lint-ignore require-await
  async () => {
    const subtreePath =
      "C:\\Users\\me\\scoop\\apps\\quarto\\current\\share\\extension-subtrees";
    const enginePath =
      "C:\\Users\\me\\scoop\\apps\\quarto\\current\\share\\extension-subtrees\\julia-engine\\_extensions\\julia-engine\\julia-engine.js";
    assert(isBundledSubtreeEnginePath(enginePath, subtreePath));
  },
);

unitTest(
  "isBundledSubtreeEnginePath - user-supplied engine path is not bundled",
  // deno-lint-ignore require-await
  async () => {
    const subtreePath = "/usr/local/share/quarto/extension-subtrees";
    const userEnginePath = "/home/me/project/_extensions/myext/my-engine.js";
    assert(!isBundledSubtreeEnginePath(userEnginePath, subtreePath));
  },
);

unitTest(
  "isBundledSubtreeEnginePath - sibling directory sharing prefix is not bundled",
  // deno-lint-ignore require-await
  async () => {
    const subtreePath = "/usr/local/share/quarto/extension-subtrees";
    const siblingPath =
      "/usr/local/share/quarto/extension-subtrees-custom/foo/_extensions/foo/foo.js";
    assert(!isBundledSubtreeEnginePath(siblingPath, subtreePath));
  },
);

unitTest(
  "isBundledSubtreeEnginePath - Windows sibling directory sharing prefix is not bundled",
  // deno-lint-ignore require-await
  async () => {
    const subtreePath =
      "C:\\Users\\me\\scoop\\apps\\quarto\\current\\share\\extension-subtrees";
    const siblingPath =
      "C:\\Users\\me\\scoop\\apps\\quarto\\current\\share\\extension-subtrees-custom\\foo\\_extensions\\foo\\foo.js";
    assert(!isBundledSubtreeEnginePath(siblingPath, subtreePath));
  },
);

unitTest(
  "filterBundledSubtreeEngines - drops bundled julia-engine in current env",
  // deno-lint-ignore require-await
  async () => {
    // Build a path that matches the resolved built-in subtree location,
    // so the test exercises the real path the production code sees.
    const bundled = {
      path: join(
        builtinSubtreeExtensions(),
        "julia-engine",
        "_extensions",
        "julia-engine",
        "julia-engine.js",
      ),
    };
    const userEngine = {
      path: "/home/me/project/_extensions/myext/my-engine.js",
    };
    assertEquals(
      filterBundledSubtreeEngines([bundled, userEngine, "julia"]),
      [userEngine, "julia"],
    );
  },
);

unitTest(
  "filterBundledSubtreeEngines - keeps string engines and engines with no path",
  // deno-lint-ignore require-await
  async () => {
    const noPath = { name: "something" } as unknown;
    assertEquals(
      filterBundledSubtreeEngines(["julia", "jupyter", noPath]),
      ["julia", "jupyter", noPath],
    );
  },
);
