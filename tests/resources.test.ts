import { assert } from "https://deno.land/std/testing/asserts.ts";
import { resourcePath } from "../src/core/resources.ts";

Deno.test("Read Pandoc Metadata Template", async () => {
  const path = resourcePath("metadata.template");
  assert(path.length > 0, "Failed to read resource metadata.template");
});
