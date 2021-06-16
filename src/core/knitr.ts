/*
* knitr.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { execProcess } from "./process.ts";
import { rBinaryPath, resourcePath } from "./resources.ts";
import { readYamlFromString } from "./yaml.ts";

export interface KnitrCapabilities {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  home: string;
  libPaths: string[];
  rmarkdown: string | null;
}

export async function knitrCapabilities() {
  try {
    const result = await execProcess({
      cmd: [
        rBinaryPath("Rscript"),
        resourcePath("capabilities/knitr.R"),
      ],
      stdout: "piped",
    });
    if (result.success && result.stdout) {
      const caps = readYamlFromString(result.stdout) as KnitrCapabilities;
      return caps;
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}
