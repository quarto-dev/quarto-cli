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

export function isMac() {
  return Deno.build.os === "darwin";
}

export function isRStudio() {
  return !!Deno.env.get("RSTUDIO");
}

export function isVSCodeOutputChannel() {
  return !!Deno.env.get("VSCODE_PID");
}

export function isVSCodeTerminal() {
  return Deno.env.get("TERM_PROGRAM") === "vscode";
}

export function isRStudioWorkbench() {
  // RS_SERVER_URL e.g. https://daily-rsw.soleng.rstudioservices.com/
  // RS_SESSION_URL e.g. /s/eae053c9ab5a71168ee19/
  return !!Deno.env.get("RS_SERVER_URL") && !!Deno.env.get("RS_SESSION_URL");
}

export function isRStudioTerminal() {
  return !!Deno.env.get("RSTUDIO_TERM");
}

export function isRStudioServer() {
  return isRStudio() && Deno.env.get("RSTUDIO_PROGRAM_MODE") === "server";
}

export function isRStudioPreview() {
  return isRStudio() && !isRStudioTerminal();
}

export function isJupyterHubServer() {
  return jupyterHubUser() !== undefined;
}

export function jupyterHubHttpReferrer() {
  return Deno.env.get("JUPYTERHUB_HTTP_REFERER");
}

export function jupyterHubUser() {
  return Deno.env.get("JUPYTERHUB_USER");
}

export function isInteractiveTerminal() {
  return Deno.isatty(Deno.stderr.rid);
}

export function isInteractiveSession() {
  return isRStudio() || isInteractiveTerminal() || isVSCodeOutputChannel();
}

export function isGithubAction() {
  return Deno.env.get("GITHUB_ACTIONS") === "true";
}
