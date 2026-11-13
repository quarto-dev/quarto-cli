/*
 * transient-notebook.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { openSync } from "../../deno_ral/fs.ts";
import { isAlreadyExists } from "../../deno_ral/errors.ts";
import { join } from "../../deno_ral/path.ts";

// Returns a free path for the transient notebook of `fileStem` in `fileDir`
// (`<stem>.quarto_ipynb`, then `<stem>.quarto_ipynb_1`, ...) and creates the
// file empty, so the name is taken at once. Checking with existsSync and
// writing the notebook later let two processes working on the same document,
// such as `quarto preview` and `quarto inspect`, pick the same name, and the
// first one to finish removed the notebook the other was still using.
export function reserveTransientNotebook(
  fileDir: string,
  fileStem: string,
): string {
  for (let counter = 0;; counter++) {
    const notebook = join(
      fileDir,
      `${fileStem}.quarto_ipynb${counter ? "_" + String(counter) : ""}`,
    );
    try {
      openSync(notebook, { write: true, createNew: true }).close();
      return notebook;
    } catch (e) {
      if (!isAlreadyExists(e)) {
        throw e;
      }
    }
  }
}
