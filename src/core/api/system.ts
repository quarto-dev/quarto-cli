// src/core/api/system.ts

import { globalRegistry } from "./registry.ts";
import type { SystemNamespace } from "./types.ts";

// Import implementations
import { isInteractiveSession } from "../platform.ts";
import { runningInCI } from "../ci-info.ts";
import { execProcess } from "../process.ts";
import { runExternalPreviewServer } from "../../preview/preview-server.ts";
import { onCleanup } from "../cleanup.ts";
import { globalTempContext } from "../temp.ts";
import { checkRender } from "../../command/check/check-render.ts";
import { pandocBinaryPath } from "../resources.ts";

// Register system namespace
globalRegistry.register("system", (): SystemNamespace => {
  return {
    isInteractiveSession,
    runningInCI,
    execProcess,
    runExternalPreviewServer,
    onCleanup,
    tempContext: globalTempContext,
    checkRender,
    pandoc: (args: string[], stdin?: string) => {
      return execProcess(
        {
          cmd: pandocBinaryPath(),
          args,
          stdout: "piped",
          stderr: "piped",
        },
        stdin,
      );
    },
  };
});
