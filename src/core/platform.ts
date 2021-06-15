/*
* platform.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function isMingw() {
  return isWindows() && !!Deno.env.get("MSYSTEM");
}

export function isWindows() {
  return Deno.build.os === "windows";
}

export function isGithubAction() {
  return Deno.env.get("GITHUB_ACTIONS") === "true";
}
