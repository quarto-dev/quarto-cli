/*
* http-reload.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ServerRequest } from "http/server.ts";

import { acceptWebSocket, WebSocket } from "ws/mod.ts";
import { maybeDisplaySocketError } from "./http.ts";
import { isRStudioServer } from "./platform.ts";
import { kLocalhost } from "./port.ts";

// track a set of http clients and notify them when to reload themselves

export interface HttpReloader {
  handle: (req: ServerRequest) => boolean;
  connect: (req: ServerRequest) => Promise<void>;
  injectClient: (file: Uint8Array, inputFile: string) => Uint8Array;
  reloadClients: (reloadTarget?: string) => Promise<void>;
}

export function httpReloader(port: number): HttpReloader {
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
    injectClient: (file: Uint8Array, inputFile: string) => {
      const scriptContents = new TextEncoder().encode(
        watchClientScript(port, inputFile),
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

function watchClientScript(port: number, inputFile: string): string {
  return `
<script>
  const socket = new WebSocket('ws://${kLocalhost}:${port}' + window.location.pathname );
  socket.onopen = () => {
    console.log('Socket connection open. Listening for events.');
  };
  socket.onmessage = (msg) => {
    if (msg.data.startsWith('reload')) {
      socket.close();
      const target = msg.data.replace(/^reload/, "").replace(/index\.html$/, "");
      if (target && (target !== window.location.pathname)) {
        window.location.replace(target.replace(/index\.html$/, ""))
      } else {
        window.location.reload(true);
      }
    } 
  };

  if (window.parent.postMessage) {
    // wait for message providing confirmation we are in a devhost
    window.addEventListener("message", function(event) {
      if (event.data.type === "devhost-init") {
        window.quartoDevhost = {
          openInputFile: function(line, column, highlight) {
            window.parent.postMessage({
              type: "openfile",
              file: "${inputFile}",
              line: line,
              column: column,
              highlight: highlight
            }, event.origin);
          }
        };
        // navigate-src
        window.parent.postMessage({
          type: "navigate-src",
          file: "${inputFile}"
        }, event.origin);
      }
    }, true);

    // notify host of navigation (e.g. for 'pop out' command)
    window.parent.postMessage({
      type: "navigate",
      href: window.location.href
    }, "*");
  }
</script>`;
}
