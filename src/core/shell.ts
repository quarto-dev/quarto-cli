/*
 * shell.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { which } from "./path.ts";
import { requireQuoting, safeWindowsExec } from "./windows.ts";
import { execProcess } from "./process.ts";

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

  const cmd = shellOpen[Deno.build.os] || "xdg-open";

  // Because URLs may contain characters like '&' that need to be escaped
  // on Windoww, we need to check whether the url is one of those
  // and use our special windows indirection in that case
  if (Deno.build.os === "windows") {
    const safeArgs = requireQuoting([url]);
    if (safeArgs.status) {
      await safeWindowsExec(
        cmd,
        safeArgs.args,
        (cmd: string[]) => {
          return execProcess(cmd[0], {
            args: cmd.slice(1),
            stdout: "piped",
            stderr: "piped",
          });
        },
      );
      return;
    }
  }
  // The traditional and simple way to run, which usually works
  if (await which(cmd)) {
    // note that we explicitly do not await this
    new Deno.Command(cmd, {
      args: [url],
    });
  }
}
