/*
 * env.test.ts
 *
 * Compatibility contract for src/deno_ral/env.ts; the Node implementation
 * must keep this file green.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertThrows } from "../../asserts.ts";
import { env } from "../../../src/deno_ral/env.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";

const kName = "QUARTO_RAL_ENV_TEST_7F3A";

// deno-lint-ignore require-await
unitTest("env - get returns undefined for an unset variable", async () => {
  env.delete(kName);
  assertEquals(env.get(kName), undefined);
});

// deno-lint-ignore require-await
unitTest("env - set, get, delete round trip", async () => {
  env.set(kName, "value-1");
  assertEquals(env.get(kName), "value-1");
  env.set(kName, "");
  assertEquals(env.get(kName), "", "empty string is a value, not unset");
  env.delete(kName);
  assertEquals(env.get(kName), undefined);
  env.delete(kName); // deleting an unset variable does not throw
  if (isWindows) {
    env.set(kName, "case");
    assertEquals(
      env.get(kName.toLowerCase()),
      "case",
      "names are case-insensitive on Windows",
    );
    env.delete(kName.toLowerCase());
    assertEquals(env.get(kName), undefined);
  }
});

// deno-lint-ignore require-await
unitTest("env - toObject is a snapshot containing set variables", async () => {
  env.set(kName, "snap");
  const all = env.toObject();
  assertEquals(all[kName], "snap");
  all[kName] = "mutated";
  assertEquals(
    env.get(kName),
    "snap",
    "mutating the snapshot does not write through",
  );
  assert(Object.keys(all).length > 1);
  env.delete(kName);
});

// deno-lint-ignore require-await
unitTest("env - invalid names throw TypeError on every runtime", async () => {
  for (const bad of ["", "A=B", "A\0B"]) {
    assertThrows(() => env.get(bad), TypeError);
    assertThrows(() => env.set(bad, "x"), TypeError);
    assertThrows(() => env.delete(bad), TypeError);
  }
  assertThrows(() => env.set(kName, "a\0b"), TypeError);
  assertEquals(env.get(kName), undefined, "a rejected set writes nothing");
});

// deno-lint-ignore require-await
unitTest("env - methods work when passed as callbacks", async () => {
  env.set(kName, "cb");
  [kName].forEach(env.delete);
  assertEquals([kName].map(env.get), [undefined]);
});
