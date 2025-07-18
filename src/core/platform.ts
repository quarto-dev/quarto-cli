/*
 * platform.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { isWindows } from "../deno_ral/platform.ts";

export function isMingw() {
  return isWindows && !!Deno.env.get("MSYSTEM");
}

export function isWSL() {
  return !!Deno.env.get("WSL_DISTRO_NAME");
}

export function isRStudio() {
  return !!Deno.env.get("RSTUDIO");
}

export function isPositron() {
  return !!Deno.env.get("POSITRON");
}

export function isVSCodeOutputChannel() {
  return !!Deno.env.get("VSCODE_PID");
}

export function isVSCodeTerminal() {
  return Deno.env.get("TERM_PROGRAM") === "vscode";
}

export function isVSCodeServer() {
  return !!vsCodeServerProxyUri();
}

export function isPositWorkbench() {
  // RS_SERVER_URL e.g. https://daily-rsw.soleng.rstudioservices.com/
  // RS_SESSION_URL e.g. /s/eae053c9ab5a71168ee19/
  return !!Deno.env.get("RS_SERVER_URL") && !!Deno.env.get("RS_SESSION_URL");
}

export function isRStudioTerminal() {
  return !!Deno.env.get("RSTUDIO_TERM");
}

export function isPositronTerminal() {
  // it seems there is no POSITRON_TERM variable set
  return isPositron();
}

export function isServerSession() {
  return isRStudioServer() || isPositWorkbench() || isJupyterServer() ||
    isJupyterHubServer() || isVSCodeServer();
}

export function isRStudioServer() {
  return isRStudio() && Deno.env.get("RSTUDIO_PROGRAM_MODE") === "server";
}

export function isRStudioPreview() {
  return isRStudio() && !isRStudioTerminal();
}

export function isJupyterServer() {
  return !!Deno.env.get("JUPYTER_SERVER_URL");
}

export function isJupyterHubServer() {
  return !!jupyterHubUser() && !!jupyterHubServicePrefix();
}

export function vsCodeServerProxyUri() {
  return Deno.env.get("VSCODE_PROXY_URI");
}

export function jupyterHubHttpReferrer() {
  return Deno.env.get("JUPYTERHUB_HTTP_REFERER");
}

export function jupyterHubUser() {
  return Deno.env.get("JUPYTERHUB_USER");
}

export function jupyterHubServicePrefix() {
  return Deno.env.get("JUPYTERHUB_SERVICE_PREFIX");
}

export function isInteractiveTerminal() {
  return Deno.stderr.isTerminal();
}

export function isInteractiveSession() {
  return isRStudio() || isInteractiveTerminal() || isVSCodeOutputChannel();
}

export function isGithubAction() {
  return Deno.env.get("GITHUB_ACTIONS") === "true";
}

export function nullDevice() {
  return isWindows ? "NUL" : "/dev/null";
}
