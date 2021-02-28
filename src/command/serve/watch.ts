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

import { ServeOptions } from "./serve.ts";

export interface ProjectWatcher {
  connect: (req: ServerRequest) => Promise<void>;
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
        // get connection sockets
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
  };
}
