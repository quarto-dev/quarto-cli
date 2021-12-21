/*
* http-devserver.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { LogRecord } from "log/mod.ts";

import { renderEjs } from "./ejs.ts";
import { maybeDisplaySocketError } from "./http.ts";
import { LogEventsHandler } from "./log.ts";
import { kLocalhost } from "./port.ts";
import { resourcePath } from "./resources.ts";

export interface HttpDevServer {
  handle: (req: Request) => boolean;
  connect: (req: Request) => Promise<Response | undefined>;
  injectClient: (
    file: Uint8Array,
    inputFile?: string,
  ) => Uint8Array;
  reloadClients: (reloadTarget?: string) => Promise<void>;
}

export function httpDevServer(
  port: number,
  isPresentation?: boolean,
): HttpDevServer {
  // track clients
  interface Client {
    path: string;
    socket: WebSocket;
  }
  const clients: Client[] = [];

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
        clients.push({ path: req.url, socket });
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
