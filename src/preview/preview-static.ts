/*
 * preview-static.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join, relative } from "../deno_ral/path.ts";
import { resourcePath } from "../core/resources.ts";
import { jatsStaticResources } from "./preview-text.ts";
import { readFile } from "../deno_ral/fs.ts";

export const staticResource = async (
  baseDir: string,
  file: string,
) => {
  const filename = relative(baseDir, file);
  const resource = kStaticResources.find((resource) => {
    return resource.name === filename;
  });

  if (resource) {
    const dir = resource.dir ? join("preview", resource.dir) : "preview";
    const path = resourcePath(join(dir, filename));
    const contents = await readFile(path);
    return {
      ...resource,
      contents,
    };
  }
};

// Static reources provide a list of 'special' resources that we should
// satisfy using internal resources
const kStaticResources = [
  ...jatsStaticResources(),
];
