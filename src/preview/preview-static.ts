/*
 * preview-static.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join, relative } from "path/mod.ts";
import { jatsStaticResources } from "./preview-jats.ts";
import { resourcePath } from "../core/resources.ts";

// Static reources provide a list of 'special' resources that we should
// satisfy using internal resources
const kStaticResources = [
  ...jatsStaticResources(),
];

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
    const contents = await Deno.readFile(path);
    return {
      ...resource,
      contents,
    };
  }
};
