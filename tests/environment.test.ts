/*
* environment.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { assert } from "testing/asserts.ts";
import { binaryPath, resourcePath } from "../src/core/resources.ts";

Deno.test("environment: resource path available", () => {
  const path = resourcePath("metadata.template");
  assert(
    path.length > 0,
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
