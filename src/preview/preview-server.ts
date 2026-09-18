/*
 * preview-server.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { MuxAsyncIterator } from "async";
import { isWindows } from "../deno_ral/platform.ts";

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
  // start the process
  const denoCommand = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    ...options,
    stdout: "piped",
    stderr: "piped",
  });

  const process = denoCommand.spawn();

  // merge and stream stdout and stderr
  const multiplexIterator = new MuxAsyncIterator<
    Uint8Array
  >();
  multiplexIterator.add(process.stdout);
  multiplexIterator.add(process.stderr);

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
      await process.output();
    },
    stop: () => {
      if (!isWindows) {
        Deno.kill(-process.pid, "SIGTERM");
      } else {
        process.kill();
      }
      return Promise.resolve();
    },
  };
}
