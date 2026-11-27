/*
 * preview-server.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { MuxAsyncIterator } from "async";
import { isWindows } from "../deno_ral/platform.ts";
import { killProcess, spawn, writeStderrSync } from "../deno_ral/process.ts";

export interface PreviewServer {
  // returns path to browse to
  start: () => Promise<string | undefined>;
  serve: () => Promise<void>;
  stop: () => Promise<void>;
}

export function noPreviewServer(): Promise<PreviewServer> {
  return Promise.resolve({
    start: () => Promise.resolve(undefined),
    serve: () => {
      return new Promise(() => {
      });
    },
    stop: () => {
      return Promise.resolve();
    },
  });
}

export function runExternalPreviewServer(options: {
  cmd: string[];
  readyPattern: RegExp;
  env?: { [key: string]: string };
  cwd?: string;
}): PreviewServer {
  const { cmd } = options;
  // start the process; on POSIX it leads its own process group so that stop()
  // also ends what it spawned (uvicorn workers, a Shiny app's R/Python children)
  const process = spawn(cmd[0], {
    args: cmd.slice(1),
    env: options.env,
    cwd: options.cwd,
    stdout: "piped",
    stderr: "piped",
    detached: !isWindows,
  });

  // merge and stream stdout and stderr
  const multiplexIterator = new MuxAsyncIterator<
    Uint8Array
  >();
  multiplexIterator.add(process.stdout!);
  multiplexIterator.add(process.stderr!);

  // wait for ready and then return from 'start'
  const decoder = new TextDecoder();
  return {
    start: async () => {
      for await (const chunk of multiplexIterator) {
        const text = decoder.decode(chunk);
        if (options.readyPattern.test(text)) {
          break;
        }
        writeStderrSync(chunk);
      }
      return "";
    },
    serve: async () => {
      for await (const chunk of multiplexIterator) {
        writeStderrSync(chunk);
      }
      await process.status;
    },
    stop: () => {
      // POSIX: SIGTERM to the group the child leads. Windows: the layer runs
      // taskkill /T on the tree rooted at the child (no groups to signal).
      try {
        killProcess(-process.pid, "SIGTERM");
      } catch {
        process.kill();
      }
      return Promise.resolve();
    },
  };
}
