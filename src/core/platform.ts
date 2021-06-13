/*
* platform.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function isMingw() {
  return Deno.build.os === "windows" && !!Deno.env.get("MSYSTEM");
}