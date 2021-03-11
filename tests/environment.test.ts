import { assert } from "https://deno.land/std/testing/asserts.ts";
import { resourcePath } from "../src/core/resources.ts";

Deno.test("environment: resource path available", () => {
  const path = resourcePath("metadata.template");
  assert(
    path.length > 0,
    "Unable to get path using resourcePath('metadata.template')",
  );
});
