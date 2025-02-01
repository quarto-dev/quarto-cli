/*
* extension-render-doc.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { safeRemoveSync } from "../../../src/core/path.ts";
import { dirname, join } from "../../../src/deno_ral/path.ts";
import { fileLoader } from "../../utils.ts";
import { fileExists, folderExists, pathDoNotExists } from "../../verify.ts";
import { testRender } from "../render/render.ts";

// This file uses custom formats 'test-html' provided by test extension
const input = fileLoader("extensions/format-resources/9918")("index.qmd", "test-html");
const rootDir = dirname(input.input)
const resourcesFile = [
  join('folder-to-root', 'dummy.txt'),
  'dummy-2.txt', 'dummy-3.txt', 'dummy-4.txt',
].map((x) => join(rootDir, x))
testRender(input.input, "test-html", false, 
  [
    folderExists(join(rootDir, "folder-to-root")),
    ...resourcesFile.map(fileExists),
    pathDoNotExists(join(rootDir, "dummy.txt")),
  ],
  {
    teardown: () => {
      resourcesFile.forEach((x) => safeRemoveSync(x));
      return Promise.resolve();
    },
  }
);