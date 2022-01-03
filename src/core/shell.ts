/*
* shell.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { which } from "./path.ts";

export async function openUrl(url: string) {
  const shellOpen = {
    windows: "explorer",
    darwin: "open",
    linux: "xdg-open",
  };
  const cmd = shellOpen[Deno.build.os];
  if (await which(cmd)) {
    Deno.run({ cmd: [cmd, url] });
  }
}
