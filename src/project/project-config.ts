/*
* project-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

export function projectConfig(dir: string) {
}

export function projectConfigDir(dir: string) {
  return join(dir, "_quarto");
}
