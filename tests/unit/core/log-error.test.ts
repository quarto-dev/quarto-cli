/*
 * log-error.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { test } from "../../test.ts";
import { printsMessage } from "../../verify.ts";
import { logError } from "../../../src/core/log.ts";

// Deno's fetch rejects with TypeError("fetch failed") and keeps the reason
// (TLS, DNS, connection) only in `cause`.
test({
  name: "logError prints the cause of a failed fetch",
  type: "unit",
  context: {},
  // deno-lint-ignore require-await
  execute: async () => {
    logError(
      new TypeError("fetch failed", {
        cause: new Error(
          "error sending request for url (https://example.com/): client error (Connect): invalid peer certificate: certificate expired",
        ),
      }),
    );
  },
  verify: [
    printsMessage({
      level: "ERROR",
      regex: /fetch failed: error sending request .*certificate expired/,
    }),
  ],
});

test({
  name: "logError prints every cause in a chain",
  type: "unit",
  context: {},
  // deno-lint-ignore require-await
  execute: async () => {
    logError(
      new Error("outer", {
        cause: new Error("middle", { cause: new Error("inner") }),
      }),
    );
  },
  verify: [
    printsMessage({ level: "ERROR", regex: /outer: middle: inner/ }),
  ],
});

test({
  name: "logError stops at a self-referencing cause",
  type: "unit",
  context: {},
  // deno-lint-ignore require-await
  execute: async () => {
    const err = new Error("self");
    err.cause = err;
    logError(err);
  },
  verify: [
    printsMessage({ level: "ERROR", regex: /^self$/m }),
  ],
});

test({
  name: "logError stops at a cause cycle",
  type: "unit",
  context: {},
  // deno-lint-ignore require-await
  execute: async () => {
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    first.cause = second;
    logError(first);
  },
  verify: [
    printsMessage({ level: "ERROR", regex: /^first: second$/m }),
  ],
});
