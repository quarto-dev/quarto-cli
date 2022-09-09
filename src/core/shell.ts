/*
* shell.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { which } from "./path.ts";
import { requireQuoting, safeWindowsExec } from "./windows.ts";
import { execProcess } from "./process.ts";

export async function openUrl(url: string) {
  const shellOpen = {
    windows: "explorer",
    darwin: "open",
    linux: "xdg-open",
  };

  const cmd = shellOpen[Deno.build.os];

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
          return execProcess({
            cmd,
            stdout: "piped",
            stderr: "piped",
          });
        },
      );
    } else {
      // The traditional and simple way to run, which usually works
      if (await which(cmd)) {
        Deno.run({ cmd: [cmd, url] });
      }
    }
  } else {
    // The traditional and simple way to run, which always
    // works outside of windows
    if (await which(cmd)) {
      Deno.run({ cmd: [cmd, url] });
    }
  }
}
