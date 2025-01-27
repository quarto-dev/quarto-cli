/*
 * expand-glob.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 *
 * Fixed version of expandGlob, expandGlobSync (https://github.com/denoland/deno_std/issues/3099)
 */

import {
  expandGlob as badExpandGlob,
  ExpandGlobOptions,
  expandGlobSync as badExpandGlobSync,
} from "../../deno_ral/fs.ts";

export function expandGlobSync(
  glob: string,
  options?: ExpandGlobOptions,
): ReturnType<typeof badExpandGlobSync> {
  if (options === undefined) {
    return badExpandGlobSync(glob, { globstar: true });
  } else {
    return badExpandGlobSync(glob, {
      ...options,
      globstar: options.globstar ?? true,
    });
  }
}

export function expandGlob(
  glob: string,
  options?: ExpandGlobOptions,
): ReturnType<typeof badExpandGlob> {
  if (options === undefined) {
    return badExpandGlob(glob, { globstar: true });
  } else {
    return badExpandGlob(glob, {
      ...options,
      globstar: options.globstar ?? true,
    });
  }
}
