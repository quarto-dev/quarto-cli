/*
 * extension-dirs.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { parse } from "@std/path";
import { join } from "../../src/deno_ral/path.ts";
import { normalizePath } from "../../src/core/path.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";

type Reply = { dirs?: string[]; error?: string };

const kTimeoutMs = 10000;

// Runs inputExtensionDirs in a Worker, so that an endless loop fails the test
// after kTimeoutMs instead of hanging the suite.
async function inputExtensionDirsInWorker(
  input: string,
  projectDir: string,
): Promise<Reply> {
  const worker = new Worker(
    new URL("./extension-dirs-worker.ts", import.meta.url).href,
    { type: "module" },
  );
  let timer: number | undefined;
  try {
    const reply = new Promise<Reply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<Reply>) => resolve(event.data);
      worker.onerror = (event: ErrorEvent) => {
        event.preventDefault();
        reject(new Error(`extension-dirs worker failed: ${event.message}`));
      };
    });
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `inputExtensionDirs did not return within ${
                kTimeoutMs / 1000
              } s with projectDir "${projectDir}": the root guard is missing`,
            ),
          ),
        kTimeoutMs,
      );
    });
    worker.postMessage({ input, projectDir });
    return await Promise.race([reply, timeout]);
  } finally {
    clearTimeout(timer);
    worker.terminate();
  }
}

// https://github.com/quarto-dev/quarto-cli/issues/14254
// An input at the filesystem root starts the walk at the root, where
// dirname() returns its argument.
unitTest("extension-dirs - terminates at the filesystem root", async () => {
  const root = parse(normalizePath(Deno.cwd())).root;
  const rootExtensionsDir = join(root, "_extensions");

  const reply = await inputExtensionDirsInWorker(root, root);

  assertEquals(reply.error, undefined);
  assertEquals(
    reply.dirs?.slice(2),
    existsSync(rootExtensionsDir, { isDirectory: true })
      ? [rootExtensionsDir]
      : [],
    `unexpected extension directories after the built-in ones: ${
      JSON.stringify(reply.dirs)
    }`,
  );
});
