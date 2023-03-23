/*
 * http-devserver.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { LogRecord } from "log/mod.ts";

import * as ld from "./lodash.ts";

import { renderEjs } from "./ejs.ts";
import { maybeDisplaySocketError } from "./http.ts";
import { FileResponse } from "./http-types.ts";
import { LogEventsHandler } from "./log.ts";
import { kLocalhost } from "./port-consts.ts";
import { resourcePath } from "./resources.ts";
import { isRStudioPreview, isRStudioServer } from "./platform.ts";
import { kTextHtml } from "./mime.ts";

export interface HttpDevServer {
  handle: (req: Request) => boolean;
  connect: (req: Request) => Promise<Response | undefined>;
  injectClient: (
    req: Request,
    file: Uint8Array,
    inputFile?: string,
  ) => FileResponse;
  clientHtml: (
    req: Request,
    inputFile?: string,
  ) => string;
  reloadClients: (reloadTarget?: string) => Promise<void>;
  hasClients: () => boolean;
}

export function httpDevServer(
  port: number,
  timeout: number,
  isRendering: () => boolean,
  stopServer: VoidFunction,
  isPresentation?: boolean,
): HttpDevServer {
  // track clients
  interface Client {
    socket: WebSocket;
  }
  const clients: Client[] = [];

  // socket close handler  that waits 2 seconds (debounced) and then
  // stops the server is there are no more clients and we are not in the
  // middle of a render. don't do this for rstudio b/c rstudio manages
  // the lifetime of quarto preview directly
  const hasClients = () => {
    return isRendering() ||
      !!clients.find((client) => client.socket.readyState !== WebSocket.CLOSED);
  };
  let onSocketClose: VoidFunction | undefined;
  if ((timeout > 0) && !isRStudioPreview()) {
    onSocketClose = ld.debounce(() => {
      if (!hasClients()) {
        stopServer();
      }
    }, timeout * 1000);
  }

  // stream log events to clients
  LogEventsHandler.onLog(async (logRecord: LogRecord, msg: string) => {
    for (let i = clients.length - 1; i >= 0; i--) {
      const socket = clients[i].socket;
      try {
        await socket.send(
          "log:" + JSON.stringify({
            ...logRecord,
            msgFormatted: msg,
          }),
        );
      } catch (_e) {
        // we don't want to recurse so we ignore errors here
      }
    }
  });

  let injectClientInitialized = false;
  let iframeURL: URL | undefined;
  const getiFrameURL = (req: Request) => {
    if (!injectClientInitialized) {
      iframeURL = viewerIFrameURL(req);
      injectClientInitialized = true;
    }
    return iframeURL;
  };

  return {
    handle: (req: Request) => {
      return req.headers.get("upgrade") === "websocket";
    },
    connect: (req: Request) => {
      try {
        const { socket, response } = Deno.upgradeWebSocket(req);
        const client: Client = { socket };
        if (onSocketClose) {
          socket.onclose = onSocketClose;
        }
        clients.push(client);
        return Promise.resolve(response);
      } catch (e) {
        maybeDisplaySocketError(e);
        return Promise.resolve(undefined);
      }
    },
    clientHtml: (
      req: Request,
      inputFile?: string,
    ): string => {
      const script = devServerClientScript(
        port,
        inputFile,
        isPresentation,
        getiFrameURL(req),
      );
      return script;
    },
    injectClient: (
      req: Request,
      file: Uint8Array,
      inputFile?: string,
    ): FileResponse => {
      const script = devServerClientScript(
        port,
        inputFile,
        isPresentation,
        getiFrameURL(req),
      );
      const scriptContents = new TextEncoder().encode("\n" + script);
      const fileWithScript = new Uint8Array(
        file.length + scriptContents.length,
      );
      fileWithScript.set(file);
      fileWithScript.set(scriptContents, file.length);
      return {
        contentType: kTextHtml,
        body: fileWithScript,
      };
    },

    reloadClients: async (reloadTarget = "") => {
      for (let i = clients.length - 1; i >= 0; i--) {
        const socket = clients[i].socket;
        try {
          const message = "reload";
          await socket.send(`${message}${reloadTarget}`);
        } catch (e) {
          maybeDisplaySocketError(e);
        } finally {
          if (!socket.CLOSED && !socket.CLOSING) {
            try {
              socket.close();
            } catch (e) {
              maybeDisplaySocketError(e);
            }
          }
          clients.splice(i, 1);
        }
      }
    },

    hasClients,
  };
}

function devServerClientScript(
  port: number,
  inputFile?: string,
  isPresentation?: boolean,
  iframeURL?: URL,
): string {
  // core devserver
  const devserver = [
    renderEjs(devserverHtmlResourcePath("core"), {
      localhost: kLocalhost,
      port,
    }),
  ];
  if (isPresentation) {
    devserver.push(
      renderEjs(devserverHtmlResourcePath("revealjs"), {}),
    );
  } else {
    // viewer devserver
    devserver.push(
      renderEjs(devserverHtmlResourcePath("viewer"), {
        inputFile: inputFile || "",
      }),
    );
  }

  if (iframeURL) {
    devserver.push(
      renderEjs(devserverHtmlResourcePath("iframe"), {
        origin: devserverOrigin(iframeURL),
        search: iframeURL.search,
      }),
    );
  }

  return devserver.join("\n");
}

function devserverOrigin(iframeURL: URL) {
  if (isRStudioServer()) {
    return iframeURL.searchParams.get("host") || iframeURL.origin;
  } else {
    return iframeURL.origin;
  }
}

function devserverHtmlResourcePath(resource: string) {
  return resourcePath(`editor/devserver/devserver-${resource}.html`);
}

export function viewerIFrameURL(req: Request) {
  for (const url of [req.url, req.referrer]) {
    const isViewer = url && (
      url.includes("capabilities=") || // rstudio viewer
      url.includes("vscodeBrowserReqId=") || // vscode simple browser
      url.includes("quartoPreviewReqId=") // generic embedded browser
    );

    if (isViewer) {
      return new URL(url);
    }
  }
}
