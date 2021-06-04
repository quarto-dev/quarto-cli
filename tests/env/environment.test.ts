/*
* environment.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { assert, assertEquals } from "testing/asserts.ts";
import { getenv } from "../../src/core/env.ts";
import { binaryPath, resourcePath } from "../../src/core/resources.ts";

Deno.test("environment: resource path available", () => {
  const path = resourcePath("metadata.template");
  assert(
    path.length > 0,
    "Unable to get path using resourcePath('metadata.template')",
  );
});

Deno.test("environment: default getenv behavior ", () => {
  const d = "B4CE1323-5ED7-43A8-AEF0-4409F42CF3C8";
  const path = getenv("D684CD56-D4DF-476D-ACB7-7E5D404BC743", d);
  assertEquals(
    path,
    d,
    "Unable to get path using resourcePath('metadata.template')",
  );
});

Deno.test("environment: binary path available", () => {
  const path = binaryPath("pandoc");
  assert(
    path.length > 0,
    "Unable to get path using binaryPath()",
  );
});
