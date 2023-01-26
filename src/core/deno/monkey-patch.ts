/*
* monkey-patch.ts
*
* Copyright (C) 2022-2023 Posit Software, PBC
*
*/

import { normalizePath } from "../path.ts";

// Window UNC paths can be mishandled by realPathSync
// (see https://github.com/quarto-dev/quarto-vscode/issues/67)
// so we monkey-patch to implement the absolute path and normalize
// parts of realPathSync (we aren't interested in the symlink
// resolution, and certainly not on windows that has no symlinks!)
Deno.realPathSync = normalizePath;
