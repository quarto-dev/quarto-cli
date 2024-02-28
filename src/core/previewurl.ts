/*
 * previewurl.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { info } from "../deno_ral/log.ts";
import * as colors from "fmt/colors.ts";

import {
  isJupyterHubServer,
  isJupyterServer,
  isRStudioServer,
  isRStudioWorkbench,
  isVSCodeServer,
  isVSCodeTerminal,
  jupyterHubHttpReferrer,
  jupyterHubUser,
  vsCodeServerProxyUri,
} from "./platform.ts";
import { execProcess } from "./process.ts";
import { kLocalhost } from "./port-consts.ts";
import { findOpenPort, waitForPort } from "./port.ts";

export interface HostAndPortOptions {
  port?: number;
  host?: string;
}

export async function resolveHostAndPort(
  options: HostAndPortOptions,
): Promise<{ host: string; port: number }> {
  const host = options.host || kLocalhost;
  let port = options.port;

  // if a specific port is requested then wait for it up to 5 seconds
  if (port) {
    if (!await waitForPort({ port: port, hostname: host })) {
      throw new Error(`Requested port ${options.port} is already in use.`);
    }
  } else {
    port = findOpenPort();
  }

  return { host, port };
}

export function previewURL(host: string, port: number, path: string) {
  // render 127.0.0.1 as localhost as not to break existing unit tests (see #947)
  const showHost = host == "127.0.0.1" ? "localhost" : host;
  const url = `http://${showHost}:${port}/${path}`;
  return url;
}

export async function printBrowsePreviewMessage(
  host: string,
  port: number,
  path: string,
) {
  if (
    (isJupyterServer() || isVSCodeTerminal()) && isRStudioWorkbench()
  ) {
    const url = await rswURL(port, path);
    info(`\nPreview server: ${previewURL(host, port, path = "")}`);
    info(`\nBrowse at ${url}`, { format: colors.green });
  } else if (isVSCodeTerminal() && isVSCodeServer()) {
    const proxyUrl = vsCodeServerProxyUri()!;
    if (proxyUrl.endsWith("/")) {
      path = path.startsWith("/") ? path.slice(1) : path;
    } else {
      path = path.startsWith("/") ? path : "/" + path;
    }
    const browseUrl = proxyUrl.replace("{{port}}", `${port}`) +
      path;
    info(`\nBrowse at ${browseUrl}`, { format: colors.green });
  } else if (isJupyterHubServer()) {
    const httpReferrer = `${
      jupyterHubHttpReferrer() || "<jupyterhub-server-url>/"
    }user/${jupyterHubUser()}/`;
    info(
      `\nBrowse at ${httpReferrer}proxy/${port}/${path}`,
      {
        format: colors.green,
      },
    );
  } else {
    const url = previewURL(host, port, path);
    if (!isRStudioServer()) {
      info(`Browse at `, {
        newline: false,
        format: colors.green,
      });
    }
    info(url, { format: (str: string) => colors.underline(colors.green(str)) });
  }
}

export async function rswURL(port: number, path: string) {
  const server = Deno.env.get("RS_SERVER_URL")!;
  const session = Deno.env.get("RS_SESSION_URL")!;
  const portToken = await rswPortToken(port);
  const url = `${server}${session.slice(1)}p/${portToken}/${path}`;
  return url;
}

async function rswPortToken(port: number) {
  const result = await execProcess("/usr/lib/rstudio-server/bin/rserver-url", {
    args: [String(port)],
    stdout: "piped",
    stderr: "piped",
  });
  if (result.success) {
    return result.stdout;
  } else {
    throw new Error(
      `Failed to map RSW port token (status ${result.code})\n${result.stderr}`,
    );
  }
}
