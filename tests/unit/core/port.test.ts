/*
 * port.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert } from "../../asserts.ts";
import { isPortSafe } from "../../../src/core/port.ts";

// Quarto fetches from the servers it starts on ports from findOpenPort
// (e.g. waiting for headless Chrome in src/core/cri/launch.ts). Deno's fetch
// refuses the Fetch standard's "bad ports", so every port isPortSafe accepts
// must be one Deno's fetch will request.
unitTest(
  "isPortSafe accepts no port that Deno's fetch blocks",
  async () => {
    const candidates: number[] = [];
    for (let port = 3000; port < 8000; ++port) {
      if (isPortSafe(port)) candidates.push(port);
    }
    const blocked: number[] = [];
    const kBatch = 500;
    for (let i = 0; i < candidates.length; i += kBatch) {
      await Promise.all(
        candidates.slice(i, i + kBatch).map(async (port) => {
          try {
            const response = await fetch(`http://127.0.0.1:${port}/`, {
              signal: AbortSignal.timeout(250),
            });
            await response.body?.cancel();
          } catch (e) {
            if (String(e).includes(`port ${port} are blocked`)) {
              blocked.push(port);
            }
          }
        }),
      );
    }
    assert(
      blocked.length === 0,
      `isPortSafe accepts ports Deno's fetch blocks: ${blocked.join(", ")}`,
    );
  },
);
