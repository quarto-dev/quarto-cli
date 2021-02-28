/*
* watch.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ServerRequest } from "http/server.ts";

import { acceptWebSocket, WebSocket } from "ws/mod.ts";

import { message } from "../../core/console.ts";

import { ProjectContext } from "../../project/project-context.ts";

import { kLocalhost, ServeOptions } from "./serve.ts";

export interface ProjectWatcher {
  handle: (req: ServerRequest) => boolean;
  connect: (req: ServerRequest) => Promise<void>;
  injectClient: (file: Uint8Array) => Uint8Array;
}

// file watcher
export function watchProject(
  project: ProjectContext,
  options: ServeOptions,
): ProjectWatcher {
  // function to handle websocket errors
  const handleError = (e: Error) => {
    if (!(e instanceof Deno.errors.BrokenPipe)) {
      if (options.debug) {
        console.error(e);
      }
      message((e as Error).message);
    }
  };

  // track client connections
  const connections: WebSocket[] = [];

  // watch project dir recursively
  const watcher = Deno.watchFs(project.dir, { recursive: true });
  const watchForChanges = () => {
    watcher.next().then(async (iter) => {
      // notify all pending connections
      if (iter.value.kind === "modify") {
        console.log(iter.value);
        // get pending sockets
        for (let i = connections.length - 1; i >= 0; i--) {
          const socket = connections[i];
          try {
            await socket.send("reload");
          } catch (e) {
            handleError(e);
          } finally {
            if (!socket.isClosed) {
              socket.close().catch(handleError);
            }
            connections.splice(i, 1);
          }
        }
      }

      // keep watching
      watchForChanges();
    });
  };
  watchForChanges();

  // return watcher interface
  return {
    handle: (req: ServerRequest) => {
      return !!options.watch && (req.headers.get("upgrade") === "websocket");
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
        connections.push(socket);
      } catch (e) {
        handleError(e);
      }
    },
    injectClient: (file: Uint8Array) => {
      if (options.watch) {
        const scriptContents = new TextEncoder().encode(
          watchClientScript(options.port),
        );
        const fileWithScript = new Uint8Array(
          file.length + scriptContents.length,
        );
        fileWithScript.set(file);
        fileWithScript.set(scriptContents, file.length);
        return fileWithScript;
      } else {
        return file;
      }
    },
  };
}

function watchClientScript(port: number): string {
  return `
<script>
  const socket = new WebSocket('ws://${kLocalhost}:${port}');
  socket.onopen = () => {
    console.log('Socket connection open. Listening for events.');
  };
  socket.onmessage = (msg) => {
    if (msg.data === 'reload') {
      socket.close();
      location.reload(true);
    } 
  };
</script>`;
}
