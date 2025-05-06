/*
 * shell.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { which } from "./path.ts";
import { requireQuoting, safeWindowsExec } from "./windows.ts";
import { execProcess } from "./process.ts";
import { isWindows, os as platformOs } from "../deno_ral/platform.ts";

export async function openUrl(url: string) {
  const shellOpen: Record<string, string> = {
    windows: "explorer",
    darwin: "open",
    // otherwise "xdg-open"
    // assume generic unix
    // in 1.32.5 this is:
    // case "linux":
    // case "netbsd":
    // case "aix":
    // case "solaris":
    // case "illumos":
    // case "freebsd":
  };

  const cmd = shellOpen[platformOs] || "xdg-open";

  // Because URLs may contain characters like '&' that need to be escaped
  // on Windows, we need to check whether the url is one of those
  // and use our special windows indirection in that case
  const safeWindowsArgs = (() => {
    if (!isWindows) {
      return undefined;
    }
    const safeArgs = requireQuoting([url]);
    if (safeArgs.status) {
      return safeArgs.args;
    }
    return undefined;
  })();

  if (safeWindowsArgs) {
    await safeWindowsExec(
      cmd,
      safeWindowsArgs,
      (cmd: string[]) => {
        return execProcess({
          cmd: cmd[0],
          args: cmd.slice(1),
          stdout: "piped",
          stderr: "piped",
        });
      },
    );
  } else {
    // The traditional and simple way to run, which usually works
    // on windows and always works outside of windows
    if (await which(cmd)) {
      execProcess({ cmd, args: [url] });
    }
  }
}
