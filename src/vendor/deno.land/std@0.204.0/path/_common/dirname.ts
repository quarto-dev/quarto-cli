// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { assertPath } from "./assert_path.ts";

export function assertArg(path: string) {
  assertPath(path);
  if (path.length === 0) return ".";
}
