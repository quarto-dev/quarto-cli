/*
 * extension-dirs-worker.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { inputExtensionDirs } from "../../src/extension/extension.ts";

type Request = { input: string; projectDir: string };

// deno-lint-ignore no-explicit-any
const worker = self as any;

worker.onmessage = (event: MessageEvent<Request>) => {
  try {
    const { input, projectDir } = event.data;
    worker.postMessage({ dirs: inputExtensionDirs(input, projectDir) });
  } catch (error) {
    worker.postMessage({ error: String(error) });
  }
};

// Tells the test that the imports have loaded, so that its timeout covers
// only the call and not the start of the Worker.
worker.postMessage({ ready: true });
