/*
 * errors.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import {
  errorWithPath,
  isAddrInUse,
  isAlreadyExists,
  isConnectionError,
  isConnectionRefused,
  isNotFound,
  isPermissionDenied,
} from "../../../src/deno_ral/errors.ts";
import { errorWithCode } from "./utils.ts";

// deno-lint-ignore require-await
unitTest("errors - predicates recognise the runtime's error classes", async () => {
  if (typeof Deno === "undefined") return; // Node: covered by the code-based case below
  const errors = Deno.errors;
  const e = (name: keyof typeof errors) => new errors[name]("x");
  assert(isNotFound(e("NotFound")));
  assert(isAlreadyExists(e("AlreadyExists")));
  assert(isPermissionDenied(e("PermissionDenied")));
  assert(isAddrInUse(e("AddrInUse")));
  assert(isConnectionRefused(e("ConnectionRefused")));
  assert(isConnectionError(e("BrokenPipe")));
  assert(isConnectionError(e("ConnectionReset")));
  assert(isConnectionError(e("ConnectionRefused")));
  assert(!isNotFound(e("AlreadyExists")));
  assert(!isConnectionError(e("NotFound")));
});

// deno-lint-ignore require-await
unitTest("errors - predicates recognise Node-style error codes", async () => {
  assert(isNotFound(errorWithCode("ENOENT")));
  assert(isAlreadyExists(errorWithCode("EEXIST")));
  assert(isPermissionDenied(errorWithCode("EACCES")));
  assert(isPermissionDenied(errorWithCode("EPERM")));
  assert(isAddrInUse(errorWithCode("EADDRINUSE")));
  assert(isConnectionRefused(errorWithCode("ECONNREFUSED")));
  assert(isConnectionError(errorWithCode("EPIPE")));
  assert(isConnectionError(errorWithCode("ECONNRESET")));
  assert(!isNotFound(errorWithCode("EEXIST")));
  assert(!isNotFound(new Error("x")));
  assert(!isNotFound(undefined));
  assert(!isNotFound("ENOENT"));
});

// deno-lint-ignore require-await
unitTest("errors - predicates look through cause (wrapped exec errors)", async () => {
  const wrapped = new Error("Error executing 'x': not found", {
    cause: errorWithCode("ENOENT"),
  });
  assert(isNotFound(wrapped));
  assert(!isAlreadyExists(wrapped));
  const plain = new Error("outer", { cause: new Error("inner") });
  assert(!isNotFound(plain));
});

// deno-lint-ignore require-await
unitTest("errors - errorWithPath appends the path exactly once", async () => {
  const e = new Error("boom");
  errorWithPath(e, "/tmp/a.txt");
  errorWithPath(e, "/tmp/a.txt");
  assertEquals(e.message, "boom\nPath: /tmp/a.txt");
  const empty = new Error("");
  errorWithPath(empty, "/tmp/b.txt");
  assertEquals(empty.message, "");
});
