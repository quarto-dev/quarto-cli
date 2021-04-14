/*
* project-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { safeExistsSync } from "../core/path.ts";
import { ProjectContext } from "./project-context.ts";

export function asNavigationalItem<T extends { href?: string; text?: string }>(
  project: ProjectContext,
  item: T | string,
): T {
  if (typeof (item) === "string") {
    if (safeExistsSync(join(project.dir, item))) {
      return {
        href: item,
      } as T;
    } else {
      return {
        text: item,
      } as T;
    }
  } else {
    return item;
  }
}
