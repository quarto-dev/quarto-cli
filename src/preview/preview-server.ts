/*
 * preview-server.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { MuxAsyncIterator } from "async/mod.ts";
import { iterateReader } from "streams/mod.ts";
import { isWindows } from "../core/platform.ts";

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
  // start the process
  const process = Deno.run({
    ...options,
    stdout: "piped",
    stderr: "piped",
  });

  // merge and stream stdout and stderr
  const multiplexIterator = new MuxAsyncIterator<
    Uint8Array
  >();
  multiplexIterator.add(iterateReader(process.stdout));
  multiplexIterator.add(iterateReader(process.stderr));

  // wait for ready and then return from 'start'
  const decoder = new TextDecoder();
  return {
    start: async () => {
      for await (const chunk of multiplexIterator) {
        const text = decoder.decode(chunk);
        if (options.readyPattern.test(text)) {
          break;
        }
        Deno.stderr.writeSync(chunk);
      }
      return "";
    },
    serve: async () => {
      for await (const chunk of multiplexIterator) {
        Deno.stderr.writeSync(chunk);
      }
      await process.status();
    },
    stop: () => {
      if (!isWindows()) {
        Deno.kill(-process.pid, "SIGTERM");
      } else {
        process.kill();
      }
      process.close();
      return Promise.resolve();
    },
  };
}
