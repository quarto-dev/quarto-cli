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

function withCode(code: string): Error {
  const e = new Error(code);
  (e as Error & { code: string }).code = code;
  return e;
}

// The runtime's own error classes, when the runtime has them (Deno). Looked up
// through globalThis so this file stays free of the Deno namespace.
// deno-lint-ignore no-explicit-any
const runtimeErrors = (globalThis as any)["Deno"]?.errors as
  | Record<string, new (msg: string) => Error>
  | undefined;

// deno-lint-ignore require-await
unitTest("errors - predicates recognise the runtime's error classes", async () => {
  if (!runtimeErrors) return; // Node: covered by the code-based case below
  const e = (name: string) => new runtimeErrors[name]("x");
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
  assert(isNotFound(withCode("ENOENT")));
  assert(isAlreadyExists(withCode("EEXIST")));
  assert(isPermissionDenied(withCode("EACCES")));
  assert(isPermissionDenied(withCode("EPERM")));
  assert(isAddrInUse(withCode("EADDRINUSE")));
  assert(isConnectionRefused(withCode("ECONNREFUSED")));
  assert(isConnectionError(withCode("EPIPE")));
  assert(isConnectionError(withCode("ECONNRESET")));
  assert(!isNotFound(withCode("EEXIST")));
  assert(!isNotFound(new Error("x")));
  assert(!isNotFound(undefined));
  assert(!isNotFound("ENOENT"));
});

// deno-lint-ignore require-await
unitTest("errors - predicates look through cause (wrapped exec errors)", async () => {
  const wrapped = new Error("Error executing 'x': not found", {
    cause: withCode("ENOENT"),
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
