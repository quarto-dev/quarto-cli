/*
 * temp.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "../../asserts.ts";
import {
  makeTempDir,
  makeTempDirSync,
  makeTempFile,
  makeTempFileSync,
  retryOnAlreadyExists,
} from "../../../src/deno_ral/temp.ts";
import { isAlreadyExists, isNotFound } from "../../../src/deno_ral/errors.ts";
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { basename, dirname, join } from "../../../src/deno_ral/path.ts";
import { errorWithCode } from "./utils.ts";

// deno-lint-ignore require-await
unitTest("temp - makeTempDirSync honours dir, prefix and suffix", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  try {
    const dir = makeTempDirSync({ dir: root, prefix: "pre-", suffix: "-suf" });
    assertEquals(dirname(dir), root);
    assert(basename(dir).startsWith("pre-"));
    assert(basename(dir).endsWith("-suf"));
    assert(existsSync(dir));
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

// deno-lint-ignore require-await
unitTest("temp - makeTempFileSync creates a file", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  try {
    const file = makeTempFileSync({ dir: root, suffix: ".json" });
    assertEquals(dirname(file), root);
    assert(file.endsWith(".json"));
    assert(existsSync(file));
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

unitTest("temp - async variants", async () => {
  const root = await makeTempDir({ prefix: "ral-temp-" });
  try {
    const dir = await makeTempDir({ dir: root });
    const file = await makeTempFile({ dir: root, prefix: "f-" });
    assert(existsSync(dir));
    assert(existsSync(file));
    assert(basename(file).startsWith("f-"));
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

unitTest("temp - a missing parent directory fails with NotFound", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  const missing = join(root, "nope", "deeper");
  try {
    const e = assertThrows(() => makeTempDirSync({ dir: missing }));
    assert(isNotFound(e), `expected NotFound, got ${e}`);
    const e2 = await assertRejects(() => makeTempFile({ dir: missing }));
    assert(isNotFound(e2), `expected NotFound, got ${e2}`);
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

// deno-lint-ignore require-await
unitTest("temp - retries only AlreadyExists, at most 5 times", async () => {
  let calls = 0;
  const flaky = () => {
    calls++;
    if (calls < 3) throw errorWithCode("EEXIST");
    return "ok";
  };
  assertEquals(retryOnAlreadyExists(flaky), "ok");
  assertEquals(calls, 3);

  calls = 0;
  const e = assertThrows(() =>
    retryOnAlreadyExists(() => {
      calls++;
      throw errorWithCode("EEXIST");
    })
  );
  assert(isAlreadyExists(e));
  assertEquals(calls, 5);

  calls = 0;
  assertThrows(() =>
    retryOnAlreadyExists(() => {
      calls++;
      throw errorWithCode("ENOENT");
    })
  );
  assertEquals(calls, 1, "other errors are not retried");
});
