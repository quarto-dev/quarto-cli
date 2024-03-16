/*
 * http-devserver.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { LogRecord } from "../deno_ral/log.ts";
import { join } from "../deno_ral/path.ts";
import * as ld from "./lodash.ts";

import { renderEjs } from "./ejs.ts";
import { httpContentResponse, maybeDisplaySocketError } from "./http.ts";
import { FileResponse } from "./http-types.ts";
import { LogEventsHandler } from "./log.ts";
import { resourcePath } from "./resources.ts";
import { isRStudioPreview, isRStudioServer } from "./platform.ts";
import { kTextHtml } from "./mime.ts";

export interface HttpDevServer {
  handle: (req: Request) => boolean;
  request: (req: Request) => Promise<Response | undefined>;
  injectClient: (
    req: Request,
    file: Uint8Array,
    inputFile?: string,
    contentType?: string,
  ) => FileResponse;
  clientHtml: (
    req: Request,
    inputFile?: string,
  ) => string;
  reloadClients: (reloadTarget?: string) => Promise<void>;
  hasClients: () => boolean;
}

export function httpDevServer(
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

  const broadcast = (msg: string) => {
    for (let i = clients.length - 1; i >= 0; i--) {
      const socket = clients[i].socket;
      try {
        socket.send(msg);
      } catch (_e) {
        // we don't want to recurse so we ignore errors here
      }
    }
  };

  // stream render events to clients
  HttpDevServerRenderMonitor.monitor({
    onRenderStart: (lastRenderTime?: number) => {
      broadcast(`render:start:${lastRenderTime || 0}`);
    },
    onRenderStop: (success: boolean) => {
      broadcast(`render:stop:${success}`);
    },
  });

  // stream log events to clients
  LogEventsHandler.onLog(async (logRecord: LogRecord, msg: string) => {
    broadcast(
      "log:" + JSON.stringify({
        ...logRecord,
        msgFormatted: msg,
      }),
    );
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

  const kQuartoPreviewJs = "quarto-preview.js";
  return {
    handle: (req: Request) => {
      // handle requests for quarto-preview.js
      const url = new URL(req.url);
      if (url.pathname.endsWith(kQuartoPreviewJs)) {
        return true;
      }

      // handle websocket upgrade requests
      if (req.headers.get("upgrade") === "websocket") {
        return true;
      }

      return false;
    },
    request: async (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname.endsWith(kQuartoPreviewJs)) {
        const path = resourcePath(join("preview", kQuartoPreviewJs));
        const contents = await Deno.readFile(path);
        return httpContentResponse(contents, "text/javascript");
      } else {
        try {
          const { socket, response } = Deno.upgradeWebSocket(req);
          const client: Client = { socket };
          socket.onmessage = (ev: MessageEvent<string>) => {
            if (ev.data === "stop") {
              stopServer();
            }
          };
          if (onSocketClose) {
            socket.onclose = onSocketClose;
          }
          clients.push(client);
          return Promise.resolve(response);
        } catch (e) {
          maybeDisplaySocketError(e);
          return Promise.resolve(undefined);
        }
      }
    },
    clientHtml: (
      req: Request,
      inputFile?: string,
    ): string => {
      const script = devServerClientScript(
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
      contentType?: string,
    ): FileResponse => {
      const script = devServerClientScript(
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
        contentType: contentType || kTextHtml,
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

export interface RenderMonitor {
  onRenderStart: (lastRenderTime?: number) => void;
  onRenderStop: (success: boolean) => void;
}

export class HttpDevServerRenderMonitor {
  public static onRenderStart() {
    this.renderStart_ = Date.now();
    this.handlers_.forEach((handler) =>
      handler.onRenderStart(this.lastRenderTime_)
    );
  }

  public static onRenderStop(success: boolean) {
    if (this.renderStart_) {
      this.lastRenderTime_ = Date.now() - this.renderStart_;
      this.renderStart_ = undefined;
    }
    this.handlers_.forEach((handler) => handler.onRenderStop(success));
  }

  public static monitor(handler: RenderMonitor) {
    this.handlers_.push(handler);
  }

  private static handlers_ = new Array<RenderMonitor>();

  private static renderStart_: number | undefined;
  private static lastRenderTime_: number | undefined;
}

function devServerClientScript(
  inputFile?: string,
  isPresentation?: boolean,
  iframeURL?: URL,
): string {
  const options = {
    origin: iframeURL ? devserverOrigin(iframeURL) : null,
    search: iframeURL ? iframeURL.search : null,
    inputFile: inputFile || null,
    isPresentation: !!isPresentation,
  };
  return renderEjs(resourcePath(`preview/quarto-preview.html`), options);
}

function devserverOrigin(iframeURL: URL) {
  if (isRStudioServer()) {
    return iframeURL.searchParams.get("host") || iframeURL.origin;
  } else {
    return iframeURL.origin;
  }
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
