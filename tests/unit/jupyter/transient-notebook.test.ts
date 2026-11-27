/*
 * transient-notebook.test.ts
 *
 * The transient notebook of a .qmd is reserved by creating the file, so two
 * renders or a render and `quarto inspect` of the same document never get
 * the same name.
 * See https://github.com/quarto-dev/quarto-cli/issues/15361
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import {
  existsSync,
  readTextFileSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { withTempDir } from "../../utils.ts";
import { reserveTransientNotebook } from "../../../src/execute/jupyter/transient-notebook.ts";

unitTest(
  "reserveTransientNotebook - takes the first name and creates the file",
  async () => {
    await withTempDir((dir) => {
      const notebook = reserveTransientNotebook(dir, "doc");
      assertEquals(notebook, join(dir, "doc.quarto_ipynb"));
      assert(existsSync(notebook), "the reserved notebook should exist");
    });
  },
);

// Two callers that reserve before either writes its notebook (the race
// between `quarto preview` and `quarto inspect`) must get different names.
unitTest(
  "reserveTransientNotebook - a second reservation gets the next name",
  async () => {
    await withTempDir((dir) => {
      const first = reserveTransientNotebook(dir, "doc");
      const second = reserveTransientNotebook(dir, "doc");
      assertEquals(first, join(dir, "doc.quarto_ipynb"));
      assertEquals(second, join(dir, "doc.quarto_ipynb_1"));
    });
  },
);

unitTest(
  "reserveTransientNotebook - skips names that exist and leaves them alone",
  async () => {
    await withTempDir((dir) => {
      writeTextFileSync(join(dir, "doc.quarto_ipynb"), "first");
      writeTextFileSync(join(dir, "doc.quarto_ipynb_1"), "second");
      const notebook = reserveTransientNotebook(dir, "doc");
      assertEquals(notebook, join(dir, "doc.quarto_ipynb_2"));
      assertEquals(readTextFileSync(join(dir, "doc.quarto_ipynb")), "first");
      assertEquals(readTextFileSync(join(dir, "doc.quarto_ipynb_1")), "second");
    });
  },
);
