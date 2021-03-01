/*
* shell.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function openUrl(url: string) {
  const shellOpen = {
    windows: "explorer",
    darwin: "open",
    linux: "xdg-open",
  };
  Deno.run({ cmd: [shellOpen[Deno.build.os], url] });
}
