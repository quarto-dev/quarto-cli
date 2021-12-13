/*
* http-reload.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ServerRequest } from "http/server_legacy.ts";

import { acceptWebSocket, WebSocket } from "ws/mod.ts";
import { isRevealjsOutput } from "../config/format.ts";
import { Format } from "../config/types.ts";
import { renderEjs } from "./ejs.ts";
import { maybeDisplaySocketError } from "./http.ts";
import { isRStudioServer } from "./platform.ts";
import { kLocalhost } from "./port.ts";
import { resourcePath } from "./resources.ts";

// track a set of http clients and notify them when to reload themselves

export interface HttpReloader {
  handle: (req: ServerRequest) => boolean;
  connect: (req: ServerRequest) => Promise<void>;
  injectClient: (
    file: Uint8Array,
    inputFile?: string,
    format?: Format,
  ) => Uint8Array;
  reloadClients: (reloadTarget?: string) => Promise<void>;
}

export function httpReloader(
  port: number,
  isPresentation?: boolean,
): HttpReloader {
  // track clients
  interface Client {
    path: string;
    socket: WebSocket;
  }
  const clients: Client[] = [];

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
  // reload devserver
  const devserver = [
    renderEjs(resourcePath("editor/devserver/devserver-reload.html"), {
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
