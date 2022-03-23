/*
* http-devserver.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { LogRecord } from "log/mod.ts";

import * as ld from "./lodash.ts";

import { renderEjs } from "./ejs.ts";
import { maybeDisplaySocketError } from "./http.ts";
import { LogEventsHandler } from "./log.ts";
import { kLocalhost } from "./port.ts";
import { resourcePath } from "./resources.ts";
import { isRStudioPreview } from "./platform.ts";

export interface HttpDevServer {
  handle: (req: Request) => boolean;
  connect: (req: Request) => Promise<Response | undefined>;
  injectClient: (
    file: Uint8Array,
    inputFile?: string,
  ) => Uint8Array;
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
    injectClient: (file: Uint8Array, inputFile?: string) => {
      const scriptContents = new TextEncoder().encode(
        "\n" + devServerClientScript(port, inputFile, isPresentation),
      );
      const fileWithScript = new Uint8Array(
        file.length + scriptContents.length,
      );
      fileWithScript.set(file);
      fileWithScript.set(scriptContents, file.length);
      return fileWithScript;
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
): string {
  // core devserver
  const devserver = [
    renderEjs(resourcePath("editor/devserver/devserver-core.html"), {
      localhost: kLocalhost,
      port,
    }),
  ];
  if (isPresentation) {
    devserver.push(
      renderEjs(resourcePath("editor/devserver/devserver-revealjs.html"), {}),
    );
  } else {
    // viewer devserver
    devserver.push(
      renderEjs(resourcePath("editor/devserver/devserver-viewer.html"), {
        inputFile: inputFile || "",
      }),
    );
  }

  return devserver.join("\n");
}
