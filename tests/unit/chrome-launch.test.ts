/*
 * chrome-launch.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertRejects } from "testing/asserts";
import { CdpClient } from "../../src/command/call/axe/scan.ts";
import { findOpenPort } from "../../src/core/port.ts";
import { unitTest } from "../test.ts";

unitTest(
  "chrome-launch - CdpClient.connect exhausts its retries with a useful message",
  async () => {
    const port = findOpenPort();
    const err = await assertRejects(() => CdpClient.connect(port), Error);
    assert(
      err.message.includes(String(port)),
      `expected port ${port} named in: ${err.message}`,
    );
  },
);
