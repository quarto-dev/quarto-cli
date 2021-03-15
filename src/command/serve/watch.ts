/*
* watch.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ServerRequest } from "http/server.ts";

import { extname, join, relative } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";

import { acceptWebSocket, WebSocket } from "ws/mod.ts";

import { ld } from "lodash/mod.ts";

import { message } from "../../core/console.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";

import {
  kLibDir,
  kOutputDir,
  ProjectContext,
} from "../../project/project-context.ts";
import {
  copyResourceFile,
  projectResourceFiles,
} from "../../project/project-resources.ts";
import { ProjectServe } from "../../project/types/project-types.ts";

import { kLocalhost, ServeOptions } from "./serve.ts";

export interface ProjectWatcher {
  handle: (req: ServerRequest) => boolean;
  connect: (req: ServerRequest) => Promise<void>;
  injectClient: (file: Uint8Array) => Uint8Array;
}

export function watchProject(
  project: ProjectContext,
  options: ServeOptions,
  projServe?: ProjectServe,
): ProjectWatcher {
  // error display
  const displayError = (e: Error) => {
    if (options.debug) {
      console.error(e);
    }
    message((e as Error).message);
  };
  const displaySocketError = (e: Error) => {
    if (!(e instanceof Deno.errors.BrokenPipe)) {
      displayError(e);
    }
  };

  // proj dir
  const projDir = Deno.realPathSync(project.dir);

  // output dir
  const outputDirConfig = project.metadata?.project?.[kOutputDir];
  let outputDir = outputDirConfig ? join(projDir, outputDirConfig) : projDir;
  ensureDirSync(outputDir);
  outputDir = Deno.realPathSync(outputDir);

  // lib dir
  const libDirConfig = project.metadata?.project?.[kLibDir];
  const libDir = libDirConfig ? join(outputDir, libDirConfig) : undefined;

  // resource files
  const resourceFiles = projectResourceFiles(project);

  // function to create an output dir path for a given project file
  const outputPath = (file: string) => {
    const sourcePath = relative(projDir, file);
    return join(outputDir, sourcePath);
  };

  // track every path that has been modified since the last reload
  const modified: string[] = [];

  // handle a watch event (return true if a reload should occur)
  const handleWatchEvent = async (event: Deno.FsEvent) => {
    try {
      if (["modify", "create"].includes(event.kind)) {
        // track modified
        modified.push(...event.paths);

        // filter out paths that no longer exist and create real paths
        const paths = event.paths.filter(existsSync).map(Deno.realPathSync);

        // notify project of files changed (return true if it indicates that
        // this change should cause a reload)
        if (projServe?.filesChanged) {
          // create paths relative to project dir
          const files = paths.map((path) => relative(project.dir, path));
          if (await projServe.filesChanged(project, files)) {
            return true;
          }
        }

        // if any of the paths are in the output dir (but not the lib dir) then return true
        const inOutputDir = paths.some((path) => {
          if (path.startsWith(outputDir)) {
            // exclude lib dir
            if (libDir && path.startsWith(libDir)) {
              return false;
            } else {
              return true;
            }
          } else {
            return false;
          }
        });
        if (inOutputDir) {
          return true;
        }

        // if it's a "hot reloading file" (e.g. css or js) and if it exists
        // in the output dir, then it coundt as "resource file"
        const hotreloadFiles = paths.filter((path) => {
          const kHotreloadExts = [".css", ".js"];
          if (kHotreloadExts.includes(extname(path).toLowerCase())) {
            return existsSync(outputPath(path));
          } else {
            return false;
          }
        });

        // (the copy will come in as another change)
        const modifiedResources = ld.intersection(
          resourceFiles.concat(hotreloadFiles),
          paths,
        ) as string[];
        for (const file of modifiedResources) {
          copyResourceFile(projDir, file, outputPath(file));
        }

        return false;
      } else {
        return false;
      }
    } catch (e) {
      displayError(e);
      return false;
    }
  };

  // track client clients
  const clients: WebSocket[] = [];

  // debounced function for notifying all clients of a change
  // (ensures that we wait for bulk file copying to complete
  // before triggering the reload)
  const reloadClients = ld.debounce(async () => {
    // see if there is a reload target (last html file modified)
    const lastHtmlFile = ld.uniq(modified).reverse().find((file) => {
      return extname(file) === ".html";
    });
    let reloadTarget = "";
    if (lastHtmlFile && options.navigate) {
      if (lastHtmlFile.startsWith(outputDir)) {
        reloadTarget = "/" + relative(outputDir, lastHtmlFile);
      } else {
        reloadTarget = "/" + relative(projDir, lastHtmlFile);
      }
      reloadTarget = pathWithForwardSlashes(reloadTarget);
    }
    modified.splice(0, modified.length);

    for (let i = clients.length - 1; i >= 0; i--) {
      const socket = clients[i];
      try {
        await socket.send(`reload${reloadTarget}`);
      } catch (e) {
        displaySocketError(e);
      } finally {
        if (!socket.isClosed) {
          socket.close().catch(displaySocketError);
        }
        clients.splice(i, 1);
      }
    }
  }, 50);

  // watch project dir recursively
  const watcher = Deno.watchFs(project.dir, { recursive: true });
  const watchForChanges = () => {
    watcher.next().then(async (iter) => {
      // see if we need to handle this
      if (await handleWatchEvent(iter.value)) {
        await reloadClients();
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
        clients.push(socket);
      } catch (e) {
        displaySocketError(e);
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
    if (msg.data.startsWith('reload')) {
      socket.close();
      const target = msg.data.replace(/^reload/, "");
      if (target && (target !== window.location.pathname)) {
        window.location.replace(target.replace(/index\.html$/, ""))
      } else {
        window.location.reload(true);
      }
    } 
  };
</script>`;
}
