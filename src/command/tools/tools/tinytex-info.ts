/*
* tools-info.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { expandPath } from "../../../core/path.ts";
import { join } from "path/mod.ts";
import { getenv } from "../../../core/env.ts";

export function tinyTexInstallDir(): string | undefined {
  switch (Deno.build.os) {
    case "windows":
      return expandPath(join(getenv("APPDATA", undefined), "TinyTeX"));
    case "linux":
      return expandPath("~/.TinyTeX");
    case "darwin":
      return expandPath("~/Library/TinyTeX");
    default:
      return undefined;
  }
}
