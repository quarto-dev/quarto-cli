/*
* http-devserver.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { LogRecord } from "log/mod.ts";

import { ServerRequest } from "http/server_legacy.ts";

import { acceptWebSocket, WebSocket } from "ws/mod.ts";
import { isRevealjsOutput } from "../config/format.ts";
import { Format } from "../config/types.ts";
import { renderEjs } from "./ejs.ts";
import { maybeDisplaySocketError } from "./http.ts";
import { LogEventsHandler } from "./log.ts";
import { isRStudioServer } from "./platform.ts";
import { kLocalhost } from "./port.ts";
import { resourcePath } from "./resources.ts";

export interface HttpDevServer {
  handle: (req: ServerRequest) => boolean;
  connect: (req: ServerRequest) => Promise<void>;
  injectClient: (
    file: Uint8Array,
    inputFile?: string,
    format?: Format,
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
      } catch (e) {
        maybeDisplaySocketError(e);
      } finally {
        if (!socket.isClosed) {
          socket.close().catch(maybeDisplaySocketError);
        }
        clients.splice(i, 1);
      }
    }
  });

  return {
    handle: (req: ServerRequest) => {
      return req.headers.get("upgrade") === "websocket";
    },
    connect: async (req: ServerRequest) => {
      const { conn, r: bufReader, w: bufWriter, headers } = req;
      try {
        const socket = await acceptWebSocket({
          conn,
          bufReader,
          bufWriter,
          headers,
        });
        clients.push({ path: req.url, socket });
      } catch (e) {
        maybeDisplaySocketError(e);
      }
    },
    injectClient: (file: Uint8Array, inputFile?: string, format?: Format) => {
      const scriptContents = new TextEncoder().encode(
        "\n" + devServerClientScript(port, inputFile, format, isPresentation),
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
        let clientReloadTarget = reloadTarget;
        const socket = clients[i].socket;
        try {
          // if this is rstudio server then we might need to include a port proxy
          if (isRStudioServer() && clientReloadTarget) {
            const prefix = clients[i].path.match(/^\/p\/\w+\//);
            if (prefix) {
              clientReloadTarget = prefix[0] +
                clientReloadTarget.replace(/^\//, "");
            }
          }
          await socket.send(`reload${clientReloadTarget}`);
        } catch (e) {
          maybeDisplaySocketError(e);
        } finally {
          if (!socket.isClosed) {
            socket.close().catch(maybeDisplaySocketError);
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
  format?: Format,
  isPresentation?: boolean,
): string {
  // core devserver
  const devserver = [
    renderEjs(resourcePath("editor/devserver/devserver-core.html"), {
      localhost: kLocalhost,
      port,
    }),
  ];
  if (isPresentation && format && isRevealjsOutput(format.pandoc)) {
    // revealjs devserver
    if (isRevealjsOutput(format.pandoc)) {
      devserver.push(
        renderEjs(resourcePath("editor/devserver/devserver-revealjs.html"), {}),
      );
    }
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
