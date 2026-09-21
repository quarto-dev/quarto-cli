// src/core/api/path.ts

import { globalRegistry } from "./registry.ts";
import type { PathNamespace } from "./types.ts";

// Import implementations
import {
  dirAndStem,
  isQmdFile,
  normalizePath,
  pathWithForwardSlashes,
} from "../path.ts";
import { quartoDataDir, quartoRuntimeDir } from "../appdirs.ts";
import { resourcePath } from "../resources.ts";
import { inputFilesDir } from "../render.ts";

// Register path namespace
globalRegistry.register("path", (): PathNamespace => {
  return {
    absolute: normalizePath,
    toForwardSlashes: pathWithForwardSlashes,
    runtime: quartoRuntimeDir,
    resource: (...parts: string[]) => {
      if (parts.length === 0) {
        return resourcePath();
      } else if (parts.length === 1) {
        return resourcePath(parts[0]);
      } else {
        // Join multiple parts with the first one
        const joined = parts.join("/");
        return resourcePath(joined);
      }
    },
    dirAndStem,
    isQmdFile,
    inputFilesDir,
    dataDir: quartoDataDir,
  };
});
