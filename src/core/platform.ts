/*
 * platform.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { isWindows } from "../deno_ral/platform.ts";
import { env } from "../deno_ral/env.ts";
import { isTerminal } from "../deno_ral/process.ts";

export function isMingw() {
  return isWindows && !!env.get("MSYSTEM");
}

export function isWSL() {
  return !!env.get("WSL_DISTRO_NAME");
}

// Test override for isRStudio — avoids Deno.env.set() race conditions
// in parallel tests. See quarto-dev/quarto-cli#14218 and PR #12621.
let _isRStudioOverride: boolean | undefined;
export function _setIsRStudioForTest(value: boolean | undefined) {
  _isRStudioOverride = value;
}

export function isRStudio() {
  if (_isRStudioOverride !== undefined) return _isRStudioOverride;
  return !!env.get("RSTUDIO");
}

export function isPositron() {
  return !!env.get("POSITRON");
}

export function isVSCodeOutputChannel() {
  return !!env.get("VSCODE_PID");
}

export function isVSCodeTerminal() {
  return env.get("TERM_PROGRAM") === "vscode";
}

export function isVSCodeServer() {
  return !!vsCodeServerProxyUri();
}

export function isPositWorkbench() {
  // RS_SERVER_URL e.g. https://daily-rsw.soleng.rstudioservices.com/
  // RS_SESSION_URL e.g. /s/eae053c9ab5a71168ee19/
  return !!env.get("RS_SERVER_URL") && !!env.get("RS_SESSION_URL");
}

export function isRStudioTerminal() {
  return !!env.get("RSTUDIO_TERM");
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
  return isRStudio() && env.get("RSTUDIO_PROGRAM_MODE") === "server";
}

export function isRStudioPreview() {
  return isRStudio() && !isRStudioTerminal();
}

export function isJupyterServer() {
  return !!env.get("JUPYTER_SERVER_URL");
}

export function isJupyterHubServer() {
  return !!jupyterHubUser() && !!jupyterHubServicePrefix();
}

export function vsCodeServerProxyUri() {
  return env.get("VSCODE_PROXY_URI");
}

export function jupyterHubHttpReferrer() {
  return env.get("JUPYTERHUB_HTTP_REFERER");
}

export function jupyterHubUser() {
  return env.get("JUPYTERHUB_USER");
}

export function jupyterHubServicePrefix() {
  return env.get("JUPYTERHUB_SERVICE_PREFIX");
}

export function isInteractiveTerminal() {
  return isTerminal("stderr");
}

export function isInteractiveSession() {
  return isRStudio() || isInteractiveTerminal() || isVSCodeOutputChannel();
}

export function nullDevice() {
  return isWindows ? "NUL" : "/dev/null";
}
