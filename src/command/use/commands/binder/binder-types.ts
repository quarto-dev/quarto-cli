/*
 * binder-types.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import SemVer from "semver/mod.ts";

export interface QuartoConfiguration {
  version?: "release" | "prerelease" | SemVer;
  tinytex?: boolean;
  chromium?: boolean;
}

export interface VSCodeConfiguration {
  version?: boolean | SemVer;
  extensions?: string[];
}

export interface PythonConfiguration {
  pip?: string[];
}

export interface RConfiguration {
  version?: SemVer;
  date?: string;
}

export interface EnvironmentConfiguration {
  apt?: string[];
}
